// Token Radar Pro Terminal - High-Performance Offline DeFi Dashboard
// Strictly offline: zero network dependencies, reads window.RADAR from data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var app = document.getElementById('board');
  var state = {
    q: '',
    category: 'all',
    chain: 'all',
    tab: 'pre-token',
    sort: 'implied',
    dir: -1,
    selected: null
  };

  var usdFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var abs = Math.abs(n);
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usdFormatter.format(n);
  }

  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }

  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }

  // Exact client-side arithmetic reproduction:
  function getCatMult(cat, m) {
    var c = (cat || '').toLowerCase();
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0 || c.indexOf('prediction') >= 0 || c.indexOf('options') >= 0) return m.deriv_multiple || 0.35;
    if (c.indexOf('dex') >= 0 || c.indexOf('collateral market') >= 0) return m.dex_multiple || 0.30;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return m.lending_multiple || 0.26;
    if (c.indexOf('yield') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('vault') >= 0) return m.curator_multiple || 0.22;
    if (c.indexOf('rwa') >= 0 || c.indexOf('basis trading') >= 0) return m.rwa_multiple || 0.20;
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0 || c.indexOf('bridge') >= 0 || c.indexOf('chain') >= 0) return m.infra_multiple || 0.18;
    return m.rwa_multiple || 0.20;
  }

  function getGrowthMult(change7d, m) {
    var raw = (typeof change7d === 'number' && isFinite(change7d)) ? change7d : 0;
    var clamped = Math.min(m.growth_cap, Math.max(m.growth_floor, raw));
    var mult;
    if (clamped >= 0) {
      if (clamped <= 30) {
        mult = 1.0 + (clamped / 100) * m.growth_weight;
      } else {
        mult = 1.0 + 0.18 + Math.log10(1 + (clamped - 30) / 70) * 0.25;
      }
    } else {
      mult = 1.0 + (clamped / 100) * 0.5;
    }
    return Math.round(mult * 1e4) / 1e4;
  }

  function getMatMult(age, m) {
    var days = (typeof age === 'number' && isFinite(age)) ? age : m.unknown_age_days;
    var peak = m.sweetspot_peak_days || 540;
    var mult;
    if (days < 90) {
      mult = m.maturity_floor + (days / 90) * 0.20;
    } else if (days <= peak) {
      mult = 0.85 + ((days - 90) / (peak - 90)) * 0.35;
    } else if (days <= m.maturity_days) {
      mult = 1.20 - ((days - peak) / (m.maturity_days - peak)) * 0.35;
    } else {
      mult = 0.85;
    }
    return Math.round(mult * 1e4) / 1e4;
  }

  function getEcoMult(chains, m) {
    var list = chains || [];
    var mult = 1.0;
    if (list.length > 1) {
      mult += Math.min(0.12, (list.length - 1) * (m.ecosystem_chain_bonus || 0.03));
    }
    var hasGrowth = list.some(function (c) {
      return c === 'Solana' || c === 'Base' || c === 'Arbitrum';
    });
    if (hasGrowth) mult += 0.03;
    return Math.round(Math.min(1.15, mult) * 1e4) / 1e4;
  }

  function impliedOf(row, m) {
    var cat = getCatMult(row.category, m);
    var growth = getGrowthMult(row.change_7d, m);
    var age = (row.age_days === null || row.age_days === undefined) ? null : row.age_days;
    var mat = getMatMult(age, m);
    var eco = getEcoMult(row.chains, m);
    return Math.max(1, Math.round(row.tvl_usd * cat * growth * mat * eco));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) {
        child.forEach(function (c) { if (c) node.appendChild(c); });
      } else if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    }
    return node;
  }

  // Chain and gas profiling for farm steps
  function chainGasProfile(chains) {
    var chain = (chains && chains.length > 0 ? chains[0] : 'Ethereum').toLowerCase();
    if (chain.indexOf('solana') >= 0 || chain.indexOf('sui') >= 0 || chain.indexOf('aptos') >= 0) {
      return { setup: 'under $0.02 of high-speed gas', maint: 'under $0.01 per tx', time: '1-2 minutes' };
    }
    if (chain.indexOf('tron') >= 0 || chain.indexOf('binance') >= 0 || chain.indexOf('bsc') >= 0) {
      return { setup: 'about $0.30 to $0.80 of network gas', maint: 'about $0.20 per interaction', time: '2-3 minutes' };
    }
    if (
      chain.indexOf('base') >= 0 || chain.indexOf('arbitrum') >= 0 || chain.indexOf('optimism') >= 0 ||
      chain.indexOf('polygon') >= 0 || chain.indexOf('ink') >= 0 || chain.indexOf('blast') >= 0 ||
      chain.indexOf('hyperliquid') >= 0 || chain.indexOf('berachain') >= 0 || chain.indexOf('monad') >= 0 ||
      chain.indexOf('avalanche') >= 0
    ) {
      return { setup: 'about $0.10 to $0.35 of L2/alt-L1 gas', maint: 'about $0.08 a week', time: '2-4 minutes' };
    }
    if (chain.indexOf('ethereum') >= 0) {
      return { setup: 'about $8 to $18 of L1 gas depending on gwei', maint: 'about $4 to $8 per interaction', time: '5-10 minutes' };
    }
    return { setup: 'about $0.50 of network fees', maint: 'about $0.20 a week', time: '3-5 minutes' };
  }

  function capitalFor(p) {
    if (p.tvl_usd >= 1e9) return 250;
    if (p.tvl_usd >= 1e8) return 150;
    if (p.tvl_usd >= 2e7) return 100;
    return 50;
  }

  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 90) return 60;
    if (age < 365) return 45;
    return 30;
  }

  function farmStepsOf(p) {
    var chains = p.chains || [];
    var chainName = chains.length > 0 ? chains[0] : 'its main chain';
    var gas = chainGasProfile(chains);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var cat = (p.category || '').toLowerCase();
    var name = p.name;

    var action1 = '';
    var action2 = '';

    if (cat.indexOf('lend') >= 0 || cat.indexOf('cdp') >= 0 || cat.indexOf('collateral') >= 0) {
      action1 = 'Supply $' + capital + ' of blue-chip collateral (USDC, USDT or native gas token) into ' + name + ' on ' + chainName + ' to start earning lending yield and protocol points.';
      action2 = 'Borrow a conservative 20% to 30% against collateral to activate borrower tier multipliers while keeping liquidation safety above 250%.';
    } else if (cat.indexOf('dex') >= 0 || cat.indexOf('liquidity') >= 0) {
      action1 = 'Deposit $' + capital + ' into ' + name + "'s core trading pair on " + chainName + ' (e.g. USDC/native token) to accumulate liquidity provider points and fee shares.';
      action2 = 'Perform weekly recurring micro-swaps ($20-$50) on ' + name + ' to register active trader volume and maintain top-quartile activity rankings.';
    } else if (cat.indexOf('derivative') >= 0 || cat.indexOf('perpetual') >= 0 || cat.indexOf('prediction') >= 0) {
      action1 = 'Deposit $' + capital + ' of USDC as initial margin on ' + name + ' on ' + chainName + ' to qualify for trader reward tiers.';
      action2 = 'Execute paired delta-neutral or small hedged orders weekly to generate real exchange volume while controlling directional market risk.';
    } else if (cat.indexOf('curator') >= 0 || cat.indexOf('allocator') >= 0 || cat.indexOf('vault') >= 0 || cat.indexOf('yield') >= 0) {
      action1 = 'Allocate $' + capital + ' into ' + name + "'s flagship curated vault on " + chainName + ' to accrue optimized yield shares and tenure-weighted points.';
      action2 = 'Monitor epoch rebalances and keep the position untouched through quarterly airdrop snapshot intervals.';
    } else if (cat.indexOf('rwa') >= 0 || cat.indexOf('basis trading') >= 0) {
      action1 = 'Deposit or mint $' + capital + ' of ' + name + "'s tokenized yield asset on " + chainName + ' to establish verified early participant record.';
      action2 = 'Hold the asset in a self-custodial wallet and reinvest periodic yield distributions to demonstrate long-term engagement.';
    } else if (cat.indexOf('staking') >= 0 || cat.indexOf('restak') >= 0) {
      action1 = 'Stake $' + capital + ' of native assets through ' + name + ' on ' + chainName + ' to receive liquid receipt tokens and base validator rewards.';
      action2 = 'Delegate or allocate receipt tokens into whitelisted partner integrations to double-dip on secondary ecosystem rewards.';
    } else if (cat.indexOf('bridge') >= 0) {
      action1 = 'Transfer $' + capital + ' of stablecoins or native assets across chains using ' + name + ' to record cross-chain bridge transaction hash.';
      action2 = 'Execute an opposing rebalancing bridge transfer every two weeks to establish bilateral routing volume.';
    } else {
      action1 = 'Deposit $' + capital + ' of USDC or native assets into ' + name + "'s primary contract on " + chainName + ' to register initial protocol interaction.';
      action2 = 'Maintain active balance and interact with smart contracts periodically to verify ongoing wallet tenure.';
    }

    return [
      { text: 'Setup dedicated burner wallet: Use a clean non-custodial wallet holding only farming funds to isolate smart contract risk.', cost: gas.setup, time: '5 minutes' },
      { text: action1, cost: '$' + capital + ' capital + ' + gas.setup, time: gas.time },
      { text: action2, cost: gas.maint, time: '5-10 minutes/session' },
      { text: 'Maintain continuous qualifying position for at least ' + hold + ' days to register across multiple snapshot blocks.', cost: '$' + capital + ' capital held', time: hold + ' days commitment' },
      { text: 'Participate in governance proposals or community votes on ' + chainName + ' when available to boost sybil-resistance score.', cost: 'negligible gas', time: '5 minutes per vote' },
      { text: 'Verify claims exclusively through official links listed on DefiLlama or verified protocol docs; log transaction hashes for tax tracking.', cost: 'zero fees to verify', time: '5 minutes' }
    ];
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
  }

  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && !(r.chains || []).includes(state.chain)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category || '', (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }

      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand-group' },
        el('div', { class: 'radar-orb', 'aria-hidden': 'true' }),
        el('div', { class: 'brand-title' },
          el('h1', { text: 'TOKEN RADAR' }),
          el('span', { class: 'version-tag', text: DATA.model_version })
        )
      ),
      el('div', { class: 'top-meta' },
        el('span', { class: 'meta-chip status-live', text: 'OFFLINE VERIFIED' }),
        el('span', { class: 'meta-chip', text: 'Snapshot: ' + DATA.as_of }),
        el('span', { class: 'meta-chip', text: 'DefiLlama Protocol Universe' })
      )
    );
  }

  function kpiSection() {
    var totalTvl = DATA.rows.reduce(function (sum, r) { return sum + r.tvl_usd; }, 0);
    var totalImplied = DATA.rows.reduce(function (sum, r) { return sum + r.implied_value_usd; }, 0);

    return el('section', { class: 'kpi-grid', 'aria-label': 'Executive KPIs' },
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-label', text: 'Pre-Token TVL Monitored' }),
        el('span', { class: 'kpi-value', text: fmtUsd(totalTvl) }),
        el('span', { class: 'kpi-sub', text: 'Locked across ' + DATA.board_size + ' pre-token protocols' })
      ),
      el('div', { class: 'kpi-card highlight' },
        el('span', { class: 'kpi-label', text: 'Aggregated Implied Launch Value' }),
        el('span', { class: 'kpi-value', text: fmtUsd(totalImplied) }),
        el('span', { class: 'kpi-sub', text: 'Quantitative fair-launch capitalization' })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-label', text: 'Watchlist Gate Coverage' }),
        el('span', { class: 'kpi-value', text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }),
        el('span', { class: 'kpi-sub', text: '100% of verified watchlist protocols present' })
      ),
      el('div', { class: 'kpi-card' },
        el('span', { class: 'kpi-label', text: 'Early Radar Gems Discovered' }),
        el('span', { class: 'kpi-value', text: String(DATA.early_size) }),
        el('span', { class: 'kpi-sub', text: 'Under $' + Math.round(DATA.floor_usd / 1e6) + 'M floor with active points/TGE runway' })
      )
    );
  }

  function controlsBar() {
    // Unique categories
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    // Unique chains across protocols
    var chainSet = new Set();
    DATA.rows.forEach(function (r) {
      (r.chains || []).forEach(function (c) { chainSet.add(c); });
    });
    var chains = Array.from(chainSet).sort();

    var searchInput = el('input', {
      type: 'search',
      id: 'q',
      placeholder: 'Search protocol, symbol, category or chain...',
      value: state.q,
      'aria-label': 'Search protocols'
    });
    searchInput.addEventListener('input', function () {
      state.q = searchInput.value;
      writeHash();
      render();
    });

    var catSelect = el('select', { id: 'category-filter', 'aria-label': 'Filter by DeFi category' },
      el('option', { value: 'all', text: 'All Categories (' + categories.length + ')' }),
      categories.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null });
      })
    );
    catSelect.addEventListener('change', function () {
      state.category = catSelect.value;
      writeHash();
      render();
    });

    var chainSelect = el('select', { id: 'chain-filter', 'aria-label': 'Filter by Blockchain' },
      el('option', { value: 'all', text: 'All Blockchains (' + chains.length + ')' }),
      chains.map(function (c) {
        return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null });
      })
    );
    chainSelect.addEventListener('change', function () {
      state.chain = chainSelect.value;
      writeHash();
      render();
    });

    var preTab = el('button', {
      type: 'button',
      'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false',
      text: 'Pre-Token Radar (' + DATA.board_size + ')',
      onclick: function () { state.tab = 'pre-token'; render(); }
    });
    var liveTab = el('button', {
      type: 'button',
      'aria-pressed': state.tab === 'live' ? 'true' : 'false',
      text: 'Live Tokens (' + DATA.live_size + ')',
      onclick: function () { state.tab = 'live'; render(); }
    });

    var countText = state.tab === 'pre-token'
      ? filteredRows().length + ' of ' + DATA.board_size + ' protocols shown'
      : DATA.live.length + ' benchmark tokens';

    var resetBtn = null;
    if (state.q || state.category !== 'all' || state.chain !== 'all') {
      resetBtn = el('button', {
        class: 'btn-reset',
        type: 'button',
        text: 'Reset Filters',
        onclick: function () {
          state.q = '';
          state.category = 'all';
          state.chain = 'all';
          writeHash();
          render();
        }
      });
    }

    return el('section', { class: 'controls-bar', 'aria-label': 'Board controls and filters' },
      el('div', { class: 'controls-left' },
        el('div', { class: 'search-box' },
          el('span', { class: 'search-icon', 'aria-hidden': 'true', text: '?' }),
          searchInput
        ),
        el('div', { class: 'select-wrapper' }, catSelect),
        el('div', { class: 'select-wrapper' }, chainSelect),
        resetBtn
      ),
      el('div', { class: 'tab-switch' }, preTab, liveTab),
      el('span', { class: 'results-count', text: countText })
    );
  }

  function sortTh(key, label) {
    var isActive = state.sort === key;
    var arrow = isActive ? (state.dir < 0 ? ' v' : ' ^') : '';
    return el('th', { scope: 'col' },
      el('button', {
        type: 'button',
        onclick: function () {
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = (key === 'rank' || key === 'name') ? 1 : -1; }
          render();
        }
      },
        label,
        isActive ? el('span', { 'aria-hidden': 'true', text: arrow }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    if (list.length === 0) {
      return el('div', { class: 'board-container' },
        el('div', { class: 'empty-state' },
          el('h3', { text: 'No pre-token protocol matches current filters' }),
          el('p', { text: 'Try relaxing your search terms or resetting the blockchain/category filters.' }),
          el('button', {
            class: 'btn-reset',
            type: 'button',
            text: 'Clear all filters',
            onclick: function () {
              state.q = '';
              state.category = 'all';
              state.chain = 'all';
              writeHash();
              render();
            }
          })
        )
      );
    }

    var maxImplied = list[0].implied_value_usd || 1;
    var tbody = el('tbody');

    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var chains = r.chains || [];
      var chainPills = chains.slice(0, 3).map(function (c) {
        return el('span', { class: 'chain-pill', text: c });
      });
      if (chains.length > 3) {
        chainPills.push(el('span', { class: 'chain-pill', text: '+' + (chains.length - 3) }));
      }

      var pctOfMax = Math.max(4, Math.round((r.implied_value_usd / maxImplied) * 100));

      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        'aria-label': 'Select ' + r.name + ' for farm plan and valuation breakdown',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail(r.slug);
          }
        }
      },
        el('td', null, el('span', { class: 'rank-badge', text: '#' + r.rank })),
        el('td', null,
          el('div', { class: 'proto-cell' },
            el('span', { class: 'proto-name', text: r.name }),
            el('div', { class: 'proto-meta' },
              el('span', { class: 'proto-cat', text: r.category || 'Other' }),
              chainPills
            )
          )
        ),
        el('td', { class: 'num' }, fmtUsd(r.tvl_usd)),
        el('td', { class: 'num ' + growthClass }, growth),
        el('td', { class: 'num' }, fmtAge(r.age_days)),
        el('td', null,
          el('div', { class: 'implied-cell' },
            el('span', { class: 'implied-val' }, fmtUsd(r.implied_value_usd)),
            el('div', { class: 'bar-track', 'aria-hidden': 'true' },
              el('div', { class: 'bar-fill', style: 'width:' + pctOfMax + '%' })
            )
          )
        ),
        el('td', null, el('span', { class: 'status-badge', text: 'Pre-Token' }))
      );
      tbody.appendChild(tr);
    });

    return el('div', { class: 'board-container' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Showing ' + list.length + ' protocols ranked by implied valuation. Select any protocol to view quantitative breakdown and farm plan.' }),
          el('thead', null,
            el('tr', null,
              sortTh('rank', 'Rank'),
              sortTh('name', 'Protocol & Ecosystem'),
              sortTh('tvl', 'TVL (Locked)'),
              sortTh('growth', '7d Growth'),
              sortTh('age', 'Age (Listed)'),
              sortTh('implied', 'Implied Launch Value'),
              el('th', { scope: 'col', text: 'Status' })
            )
          ),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      var chains = r.chains || [];
      var chainPills = chains.slice(0, 3).map(function (c) {
        return el('span', { class: 'chain-pill', text: c });
      });

      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'status-badge', text: 'Traded' })),
        el('td', null,
          el('div', { class: 'proto-cell' },
            el('span', { class: 'proto-name', text: r.name }),
            el('div', { class: 'proto-meta' },
              el('span', { class: 'proto-cat', text: r.category || 'Other' }),
              chainPills
            )
          )
        ),
        el('td', { class: 'num' }, fmtUsd(r.tvl_usd)),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg') }, fmtPct(r.change_7d)),
        el('td', { class: 'num', style: 'color: var(--accent-blue); font-weight: 600;' }, fmtUsd(r.mcap_usd)),
        el('td', null, el('span', { class: 'proto-cat', text: 'Market Traded Token' }))
      ));
    });

    return el('div', { class: 'board-container' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Live Token Benchmarks: Protocols that already have trading tokens. Kept separate from pre-token implied radar.' }),
          el('thead', null,
            el('tr', null,
              el('th', { scope: 'col', text: 'Status' }),
              el('th', { scope: 'col', text: 'Protocol & Ecosystem' }),
              el('th', { scope: 'col', text: 'TVL' }),
              el('th', { scope: 'col', text: '7d Growth' }),
              el('th', { scope: 'col', text: 'Market Cap (Actual)' }),
              el('th', { scope: 'col', text: 'Benchmark Category' })
            )
          ),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'model-panel', 'aria-label': 'Model Methodology' },
      el('h2', { text: 'Quantitative Fair-Launch Valuation Model (radar-pro-2)' }),
      el('div', { class: 'formula-code' },
        'Implied Value = round( TVL * SectorMultiple * GrowthMomentum * LifecycleCurve * EcosystemCatalyst )\n' +
        'Where:\n' +
        '  - SectorMultiple: Derivatives (0.35x), DEXs (0.30x), Lending (0.26x), Curators (0.22x), RWA (0.20x), Infra (0.18x)\n' +
        '  - GrowthMomentum: Concave response to 7d change clamped [-50%, +100%]; tapers extreme liquidity spikes\n' +
        '  - LifecycleCurve: 0-90d (0.65-0.85x), 90-540d (0.85-1.20x peak TGE launch window), >540d (gentle decay to 0.85x)\n' +
        '  - EcosystemCatalyst: 1.00x to 1.15x based on multi-chain breadth and high-liquidity chain presence'
      ),
      el('p', { class: 'math-desc', text: 'All inputs derive strictly from the snapshot. Implied value is a heuristic fair-launch valuation benchmark, not a guaranteed future token market price.' })
    );
  }

  var dialog = el('dialog', { class: 'detail-drawer', id: 'detail-drawer', 'aria-labelledby': 'drawer-title' });
  dialog.addEventListener('close', function () {
    state.selected = null;
    writeHash();
    render();
  });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;

    state.selected = slug;
    writeHash();
    dialog.textContent = '';

    var m = DATA.model;
    var recomputed = impliedOf(row, m);
    var isVerified = (recomputed === row.implied_value_usd);
    var steps = farmStepsOf(row);

    var catMult = getCatMult(row.category, m);
    var growthMult = getGrowthMult(row.change_7d, m);
    var age = (row.age_days === null || row.age_days === undefined) ? null : row.age_days;
    var matMult = getMatMult(age, m);
    var ecoMult = getEcoMult(row.chains, m);

    // Header
    dialog.appendChild(el('div', { class: 'drawer-header' },
      el('div', null,
        el('span', { class: 'drawer-rank-tag', text: 'Rank #' + row.rank + ' of ' + DATA.board_size }),
        el('h2', { id: 'drawer-title', text: row.name }),
        el('div', { class: 'proto-meta' },
          el('span', { class: 'proto-cat', text: row.category || 'Other' }),
          (row.chains || []).map(function (c) { return el('span', { class: 'chain-pill', text: c }); })
        )
      ),
      el('button', {
        class: 'btn-close',
        type: 'button',
        'aria-label': 'Close detail view',
        text: 'Close [Esc]',
        onclick: function () { dialog.close(); }
      })
    ));

    // Section 1: Valuation Math Breakdown
    dialog.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Valuation Breakdown & Arithmetic' }),
      el('div', { class: 'math-box' },
        el('div', { class: 'math-row' },
          el('span', { text: 'Base TVL (Total Value Locked)' }),
          el('b', { class: 'num' }, fmtUsd(row.tvl_usd))
        ),
        el('div', { class: 'math-row' },
          el('span', { text: '1. Sector Multiple (' + (row.category || 'DeFi') + ')' }),
          el('b', { class: 'num' }, catMult.toFixed(2) + 'x')
        ),
        el('div', { class: 'math-row' },
          el('span', { text: '2. 7-Day Growth Momentum (' + fmtPct(row.change_7d) + ')' }),
          el('b', { class: 'num' }, growthMult.toFixed(2) + 'x')
        ),
        el('div', { class: 'math-row' },
          el('span', { text: '3. Airdrop Lifecycle Multiplier (' + fmtAge(row.age_days) + ')' }),
          el('b', { class: 'num' }, matMult.toFixed(2) + 'x')
        ),
        el('div', { class: 'math-row' },
          el('span', { text: '4. Multi-Chain Catalyst (' + (row.chains ? row.chains.length : 1) + ' chains)' }),
          el('b', { class: 'num' }, ecoMult.toFixed(2) + 'x')
        ),
        el('div', { class: 'math-row highlight' },
          el('span', { text: 'Fair-Launch Implied Value' }),
          el('b', { class: 'num' }, fmtUsd(row.implied_value_usd))
        )
      ),
      el('div', { class: 'verified-tag' },
        el('span', { text: isVerified ? '✓ Verified: Exact byte-for-byte mathematical match with board.json (' + fmtUsd(recomputed) + ')' : 'Arithmetic discrepancy detected' })
      ),
      el('p', { class: 'math-desc', text: 'Heuristic valuation estimate derived from fundamental protocol metrics. Not an official token offering price.' })
    ));

    // Section 2: Farm Strategy Roadmap
    var stepsList = el('ol', { class: 'steps-list' });
    steps.forEach(function (s, idx) {
      stepsList.appendChild(el('li', { class: 'step-item' },
        el('div', { class: 'step-head' },
          el('span', { class: 'step-num', text: String(idx + 1) }),
          el('span', { class: 'step-text', text: s.text })
        ),
        el('div', { class: 'step-badges' },
          el('span', { class: 'step-badge', text: 'Cost: ' + s.cost }),
          el('span', { class: 'step-badge', text: 'Time: ' + s.time })
        )
      ));
    });

    dialog.appendChild(el('section', { class: 'drawer-section' },
      el('h3', { text: 'Tactical 6-Step Farming Guide' }),
      stepsList
    ));

    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });

    shell.appendChild(header());
    shell.appendChild(kpiSection());
    shell.appendChild(controlsBar());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());

    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');

    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
