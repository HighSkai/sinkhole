import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

/**
 * Precompress text assets with brotli + gzip so Caddy/nginx can serve them
 * straight from disk (`precompressed br gzip` / `brotli_static` + `gzip_static`).
 */
function precompress(): Plugin {
  const exts = new Set(['.js', '.css', '.html', '.svg', '.json', '.txt', '.xml', '.webmanifest']);
  let outDir = 'dist';
  return {
    name: 'sinkhole:precompress',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir;
    },
    closeBundle() {
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => {
          const p = join(dir, f);
          return statSync(p).isDirectory() ? walk(p) : [p];
        });
      for (const file of walk(outDir)) {
        if (!exts.has(extname(file))) continue;
        const src = readFileSync(file);
        if (src.length < 1024) continue;
        const br = brotliCompressSync(src, {
          params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: src.length }
        });
        const gz = gzipSync(src, { level: 9 });
        if (br.length < src.length) writeFileSync(file + '.br', br);
        if (gz.length < src.length) writeFileSync(file + '.gz', gz);
      }
    }
  };
}

/**
 * The shell paints first, but the default page (Pipeline) and the data source are
 * needed right after — hint them so they download in parallel instead of in a waterfall.
 */
function preloadDefaultRoute(): Plugin {
  return {
    name: 'sinkhole:preload-default-route',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        if (!ctx.bundle) return;
        const wanted = [/PipelinePage\.svelte$/, /data[\\/]mock\.ts$/];
        const chunks = Object.values(ctx.bundle).filter((c) => c.type === 'chunk');
        const already = new Set(chunks.filter((c) => c.isEntry).flatMap((c) => [c.fileName, ...c.imports]));
        const js = new Set<string>();
        const css = new Set<string>();
        for (const c of chunks) {
          if (!c.facadeModuleId || !wanted.some((re) => re.test(c.facadeModuleId!))) continue;
          for (const f of [c.fileName, ...c.imports]) if (!already.has(f)) js.add(f);
          for (const f of c.viteMetadata?.importedCss ?? []) css.add(f);
        }
        return [
          ...[...js].map((f) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: '', href: '/' + f },
            injectTo: 'head' as const
          })),
          ...[...css].map((f) => ({
            tag: 'link',
            attrs: { rel: 'preload', as: 'style', crossorigin: '', href: '/' + f },
            injectTo: 'head' as const
          }))
        ];
      }
    }
  };
}

/** ANALYZE=1 npm run build → top modules per chunk (rendered bytes, pre-minify). */
function analyze(): Plugin {
  return {
    name: 'sinkhole:analyze',
    apply: () => !!process.env.ANALYZE,
    generateBundle(_o, bundle) {
      for (const c of Object.values(bundle)) {
        if (c.type !== 'chunk') continue;
        const mods = Object.entries(c.modules)
          .map(([id, m]) => [id.replace(/.*node_modules[\\/]/, '').replace(/.*src[\\/]/, 'src/'), m.renderedLength] as const)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 14);
        console.log('\n' + c.fileName);
        for (const [id, n] of mods) console.log('  ' + String(n).padStart(7) + '  ' + id);
      }
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), svelte(), preloadDefaultRoute(), precompress(), analyze()],
  build: {
    target: 'es2022',
    cssCodeSplit: true,
    assetsInlineLimit: 0,
    reportCompressedSize: true,
    manifest: true,
    rolldownOptions: {
      output: {
        // Fold the many tiny shared UI modules into one chunk instead of a dozen
        // 1 KB requests (each with its own gzip/HTTP overhead).
        codeSplitting: {
          groups: [
            {
              name: 'ui',
              test: /[\\/](src[\\/]lib[\\/](ui|logo|format|icons)|src[\\/]lib[\\/]data[\\/]types|src[\\/]pages[\\/]pipeline[\\/]geometry|@lucide[\\/]svelte|svelte[\\/]src[\\/](animate|events|motion))/
            }
          ]
        }
      }
    }
  },
  server: { port: 5173 },
  preview: { port: 4173 }
});
