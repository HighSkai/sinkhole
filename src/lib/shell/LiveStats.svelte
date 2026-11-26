<script lang="ts">
  import { sinkhole } from '../data/store.svelte';
  import { fmt, fmtUptime } from '../format';

  const uptime = $derived(fmtUptime(sinkhole.now - sinkhole.startedAt));
</script>

<dl class="stats mono" aria-label="Live statistics">
  <div><dt>Q/s:</dt><dd>{sinkhole.qps.toFixed(1)}</dd></div>
  <div><dt>Blocked:</dt><dd class:dim={sinkhole.paused}>{sinkhole.blockedPct.toFixed(1)}%</dd></div>
  <div><dt>Lists:</dt><dd>{sinkhole.activeLists.length} ({fmt(sinkhole.totalDomains)} domains)</dd></div>
  <div><dt>Uptime:</dt><dd>{uptime}</dd></div>
  <div class="conn" class:off={!sinkhole.connected}>
    <span class="led"></span>{sinkhole.connected ? (sinkhole.sourceKind === 'mock' ? 'mock stream' : 'live') : 'reconnecting…'}
  </div>
</dl>

<style>
  .stats {
    position: fixed;
    right: 24px;
    bottom: 24px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    font-size: 11px;
    line-height: 16px;
    text-align: right;
    pointer-events: none;
  }
  .stats > div {
    display: flex;
    gap: 6px;
  }
  dt {
    color: var(--color-muted);
  }
  dd {
    color: var(--color-ink);
  }
  dd.dim {
    color: var(--color-faint);
  }
  .conn {
    margin-top: 6px;
    align-items: center;
    color: var(--color-faint);
  }
  .led {
    width: 5px;
    height: 5px;
    border-radius: 9px;
    background: var(--color-allow);
    box-shadow: 0 0 6px var(--color-allow);
  }
  .off .led {
    background: var(--color-block);
    box-shadow: 0 0 6px var(--color-block);
  }
  @media (max-width: 1023px) {
    .stats {
      right: 16px;
      bottom: 16px;
      font-size: 10px;
      line-height: 14px;
    }
    .conn {
      display: none !important;
    }
  }
  /* narrow screens: sit above the command bar instead of beside it */
  @media (max-width: 860px) {
    .stats {
      bottom: 132px;
    }
  }
</style>
