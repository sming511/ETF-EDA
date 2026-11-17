const API_PATH = location.hostname.endsWith("github.io")
  ? "https://naver-etf-signal-board.todaycode-8480.chatgpt.site/api/etf"
  : "/api/etf";
const REFRESH_SECONDS = 60;

const MARKET_META = {
  1: { label: "국내 시장지수", color: "#0c6d65" },
  2: { label: "국내 업종·테마", color: "#39c5a3" },
  3: { label: "국내 파생", color: "#ef704e" },
  4: { label: "해외 주식", color: "#3d70bd" },
  5: { label: "원자재", color: "#c99736" },
  6: { label: "채권", color: "#7a66ae" },
  7: { label: "기타", color: "#82908b" }
};

const MANAGER_BY_BRAND = {
  KODEX: "삼성자산운용",
  TIGER: "미래에셋자산운용",
  RISE: "KB자산운용",
  ACE: "한국투자신탁운용",
  PLUS: "한화자산운용",
  SOL: "신한자산운용",
  KIWOOM: "키움투자자산운용",
  HANARO: "NH-Amundi자산운용",
  TIME: "타임폴리오자산운용",
  KoAct: "삼성액티브자산운용",
  UNICORN: "현대자산운용",
  "1Q": "하나자산운용",
  FOCUS: "브이아이자산운용",
  DAISHIN: "대신자산운용",
  WOORI: "우리자산운용",
  ITF: "IBK자산운용",
  BNK: "BNK자산운용",
  TREX: "유리자산운용",
  MIGHTY: "DB자산운용",
  HK: "흥국자산운용",
  KCGI: "KCGI자산운용",
  MASTER: "마이다스에셋자산운용"
};

const PRODUCT_ORDER = ["국내주식", "해외주식", "채권·금리", "액티브", "커버드콜", "레버리지", "인버스", "원자재", "혼합·기타"];

const state = {
  items: [],
  filtered: [],
  view: "overview",
  page: 1,
  pageSize: 20,
  sortKey: "marketSum",
  sortDirection: "desc",
  countdown: REFRESH_SECONDS,
  loading: false,
  lastUpdated: null
};

const el = Object.fromEntries([
  "updatedAt", "refreshButton", "countdown", "searchInput", "managerFilter", "marketFilter",
  "productFilter", "resetFilters", "statusBanner", "metricCount", "metricCountNote",
  "metricMarketCap", "metricTurnover", "metricAverage", "metricAverageNote", "upCount",
  "flatCount", "downCount", "upPulse", "flatPulse", "downPulse", "pulseLabel", "managerBars",
  "marketDonut", "marketLegend", "moversList", "managerRanking", "marketCards", "productCards",
  "resultCount", "pageSize", "etfTableBody", "prevPage", "nextPage", "pageInfo",
  "detailDrawer", "drawerBackdrop", "drawerContent", "closeDrawer"
].map(id => [id, document.getElementById(id)]));

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function inferManager(name) {
  const brand = Object.keys(MANAGER_BY_BRAND).find(key => name === key || name.startsWith(`${key} `));
  return brand ? MANAGER_BY_BRAND[brand] : "기타·미분류";
}

function inferProduct(item, marketLabel) {
  const name = item.itemname.toUpperCase();
  if (/인버스/.test(name)) return "인버스";
  if (/레버리지|2X/.test(name)) return "레버리지";
  if (/커버드콜/.test(name)) return "커버드콜";
  if (/액티브/.test(name)) return "액티브";
  if (marketLabel === "채권" || /채권|국채|회사채|CD금리|KOFR|머니마켓|단기금리/.test(name)) return "채권·금리";
  if (marketLabel === "원자재") return "원자재";
  if (marketLabel === "해외 주식") return "해외주식";
  if (marketLabel === "기타" || /혼합|TDF|리츠/.test(name)) return "혼합·기타";
  return "국내주식";
}

function normalizeItem(item) {
  const code = toNumber(item.etfTabCode);
  const market = MARKET_META[code]?.label || "기타";
  const nav = toNumber(item.nav);
  const nowVal = toNumber(item.nowVal);
  return {
    ...item,
    etfTabCode: code,
    nowVal,
    changeVal: toNumber(item.changeVal),
    changeRate: toNumber(item.changeRate),
    nav,
    threeMonthEarnRate: item.threeMonthEarnRate == null ? null : toNumber(item.threeMonthEarnRate),
    quant: toNumber(item.quant),
    amonut: toNumber(item.amonut),
    marketSum: toNumber(item.marketSum),
    manager: inferManager(item.itemname),
    market,
    product: inferProduct(item, market),
    navGap: nav ? ((nowVal - nav) / nav) * 100 : null
  };
}

function formatPrice(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function formatMarketCap(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}조원`;
  return `${Math.round(value).toLocaleString("ko-KR")}억원`;
}

function formatTurnover(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}조원`;
  if (value >= 100) return `${(value / 100).toFixed(0)}억원`;
  return `${Math.round(value).toLocaleString("ko-KR")}백만원`;
}

function formatVolume(value) {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}억주`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}만주`;
  return `${Math.round(value).toLocaleString("ko-KR")}주`;
}

function formatRate(value, digits = 2) {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function rateClass(value) {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function shortManager(name) {
  return name.replace("자산운용", "").replace("투자신탁운용", "투신");
}

function groupStats(items, key) {
  const map = new Map();
  items.forEach(item => {
    const name = item[key];
    if (!map.has(name)) map.set(name, { name, count: 0, marketSum: 0, amonut: 0, rateTotal: 0, rateCount: 0 });
    const row = map.get(name);
    row.count += 1;
    row.marketSum += item.marketSum;
    row.amonut += item.amonut;
    if (Number.isFinite(item.changeRate)) {
      row.rateTotal += item.changeRate;
      row.rateCount += 1;
    }
  });
  return [...map.values()].map(row => ({ ...row, avgRate: row.rateCount ? row.rateTotal / row.rateCount : 0 }));
}

async function decodeNaverResponse(response) {
  const buffer = await response.arrayBuffer();
  let text;
  try {
    text = new TextDecoder("euc-kr").decode(buffer);
  } catch {
    text = new TextDecoder("utf-8").decode(buffer);
  }
  return JSON.parse(text);
}

async function fetchData({ silent = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  el.refreshButton.classList.add("loading");
  if (!silent) setBanner("loading", "네이버 금융에서 최신 ETF 시세를 불러오고 있습니다.");

  try {
    const response = await fetch(`${API_PATH}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`시세 API 응답 오류 (${response.status})`);
    const payload = await decodeNaverResponse(response);
    const list = payload?.result?.etfItemList;
    if (payload?.resultCode !== "success" || !Array.isArray(list)) throw new Error("ETF 데이터 형식을 확인할 수 없습니다.");

    state.items = list.map(normalizeItem);
    state.lastUpdated = new Date();
    state.countdown = REFRESH_SECONDS;
    populateFilters();
    applyFilters({ keepPage: true });
    setBanner("success");
    updateTimestamp();
  } catch (error) {
    console.error(error);
    setBanner("error", `데이터를 불러오지 못했습니다. ${error.message} 잠시 후 다시 시도해 주세요.`);
    if (!state.items.length) renderEmptyState();
  } finally {
    state.loading = false;
    el.refreshButton.classList.remove("loading");
  }
}

function setBanner(type, message = "") {
  if (type === "success") {
    el.statusBanner.hidden = true;
    return;
  }
  el.statusBanner.hidden = false;
  el.statusBanner.textContent = message;
}

function updateTimestamp() {
  if (!state.lastUpdated) return;
  const formatted = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(state.lastUpdated);
  el.updatedAt.textContent = `${formatted} 기준`;
}

function populateFilters() {
  const currentManager = el.managerFilter.value;
  const currentMarket = el.marketFilter.value;
  const currentProduct = el.productFilter.value;
  const managers = groupStats(state.items, "manager").sort((a, b) => b.marketSum - a.marketSum);

  el.managerFilter.innerHTML = `<option value="all">전체 운용사</option>${managers.map(row => `<option value="${escapeHtml(row.name)}">${escapeHtml(row.name)} (${row.count})</option>`).join("")}`;
  el.marketFilter.innerHTML = `<option value="all">전체 시장</option>${Object.values(MARKET_META).map(meta => {
    const count = state.items.filter(item => item.market === meta.label).length;
    return `<option value="${meta.label}">${meta.label} (${count})</option>`;
  }).join("")}`;
  el.productFilter.innerHTML = `<option value="all">전체 상품</option>${PRODUCT_ORDER.map(product => {
    const count = state.items.filter(item => item.product === product).length;
    return count ? `<option value="${product}">${product} (${count})</option>` : "";
  }).join("")}`;

  if ([...el.managerFilter.options].some(option => option.value === currentManager)) el.managerFilter.value = currentManager;
  if ([...el.marketFilter.options].some(option => option.value === currentMarket)) el.marketFilter.value = currentMarket;
  if ([...el.productFilter.options].some(option => option.value === currentProduct)) el.productFilter.value = currentProduct;
}

function applyFilters({ keepPage = false } = {}) {
  const query = el.searchInput.value.trim().toLowerCase();
  const manager = el.managerFilter.value;
  const market = el.marketFilter.value;
  const product = el.productFilter.value;

  state.filtered = state.items.filter(item => {
    const matchesQuery = !query || item.itemname.toLowerCase().includes(query) || item.itemcode.toLowerCase().includes(query);
    return matchesQuery && (manager === "all" || item.manager === manager) && (market === "all" || item.market === market) && (product === "all" || item.product === product);
  });
  if (!keepPage) state.page = 1;
  renderAll();
}

function renderAll() {
  renderMetrics();
  renderPulse();
  renderManagerBars();
  renderMarketDonut();
  renderMovers();
  renderManagerRanking();
  renderMarketCards();
  renderProductCards();
  renderTable();
}

function renderMetrics() {
  const items = state.filtered;
  const marketSum = items.reduce((sum, item) => sum + item.marketSum, 0);
  const turnover = items.reduce((sum, item) => sum + item.amonut, 0);
  const average = items.length ? items.reduce((sum, item) => sum + item.changeRate, 0) / items.length : 0;
  el.metricCount.textContent = `${items.length.toLocaleString("ko-KR")}개`;
  el.metricCountNote.textContent = items.length === state.items.length ? "전체 상장 ETF" : `전체 ${state.items.length.toLocaleString("ko-KR")}개 중 조회 결과`;
  el.metricMarketCap.textContent = formatMarketCap(marketSum);
  el.metricTurnover.textContent = formatTurnover(turnover);
  el.metricAverage.textContent = formatRate(average);
  el.metricAverage.className = rateClass(average);
  el.metricAverageNote.textContent = average > 0 ? "평균 상승 흐름" : average < 0 ? "평균 하락 흐름" : "평균 보합 흐름";
}

function renderPulse() {
  const total = state.filtered.length || 1;
  const up = state.filtered.filter(item => item.changeRate > 0).length;
  const flat = state.filtered.filter(item => item.changeRate === 0).length;
  const down = state.filtered.filter(item => item.changeRate < 0).length;
  el.upCount.textContent = up.toLocaleString("ko-KR");
  el.flatCount.textContent = flat.toLocaleString("ko-KR");
  el.downCount.textContent = down.toLocaleString("ko-KR");
  el.upPulse.style.width = `${(up / total) * 100}%`;
  el.flatPulse.style.width = `${(flat / total) * 100}%`;
  el.downPulse.style.width = `${(down / total) * 100}%`;
  el.pulseLabel.textContent = up > down ? "상승 우위" : down > up ? "하락 우위" : "균형";
}

function renderManagerBars() {
  const rows = groupStats(state.filtered, "manager").sort((a, b) => b.marketSum - a.marketSum).slice(0, 7);
  const max = rows[0]?.marketSum || 1;
  el.managerBars.classList.remove("skeleton-block");
  el.managerBars.innerHTML = rows.length ? rows.map(row => `
    <div class="bar-row">
      <span class="bar-label" title="${escapeHtml(row.name)}">${escapeHtml(shortManager(row.name))}</span>
      <span class="bar-track"><i class="bar-fill" style="width:${Math.max(2, (row.marketSum / max) * 100)}%"></i></span>
      <span class="bar-value">${(row.marketSum / 10000).toFixed(1)}조</span>
    </div>`).join("") : `<div class="empty-cell">조회 결과가 없습니다.</div>`;
}

function renderMarketDonut() {
  const rows = groupStats(state.filtered, "market").sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  let cursor = 0;
  const stops = rows.map(row => {
    const start = cursor;
    cursor += (row.count / total) * 100;
    const color = Object.values(MARKET_META).find(meta => meta.label === row.name)?.color || "#82908b";
    return `${color} ${start}% ${cursor}%`;
  });
  el.marketDonut.classList.remove("skeleton-circle");
  el.marketDonut.style.background = stops.length ? `conic-gradient(${stops.join(",")})` : "#e6ece7";
  el.marketDonut.innerHTML = `<div><strong>${state.filtered.length.toLocaleString("ko-KR")}</strong><span>ETF</span></div>`;
  el.marketLegend.innerHTML = rows.slice(0, 7).map(row => {
    const color = Object.values(MARKET_META).find(meta => meta.label === row.name)?.color || "#82908b";
    return `<div class="legend-row"><i style="background:${color}"></i><span>${escapeHtml(row.name)}</span><b>${row.count}</b></div>`;
  }).join("");
}

function renderMovers() {
  const valid = state.filtered.filter(item => Number.isFinite(item.changeRate));
  const rising = [...valid].sort((a, b) => b.changeRate - a.changeRate).slice(0, 4);
  const falling = [...valid].sort((a, b) => a.changeRate - b.changeRate).slice(0, 4);
  const column = (title, rows) => `<div class="mover-column"><h3>${title}</h3>${rows.map(item => `
    <div class="mover-row"><button type="button" data-detail="${item.itemcode}"><strong title="${escapeHtml(item.itemname)}">${escapeHtml(item.itemname)}</strong><span class="${rateClass(item.changeRate)}">${formatRate(item.changeRate)}</span></button></div>
  `).join("")}</div>`;
  el.moversList.classList.remove("skeleton-block");
  el.moversList.innerHTML = valid.length ? column("상승률 상위", rising) + column("하락률 상위", falling) : `<div class="empty-cell">조회 결과가 없습니다.</div>`;
}

function renderManagerRanking() {
  const rows = groupStats(state.filtered, "manager").sort((a, b) => b.marketSum - a.marketSum).slice(0, 12);
  el.managerRanking.innerHTML = rows.map((row, index) => `
    <button class="ranking-item" type="button" data-manager="${escapeHtml(row.name)}">
      <span class="rank">${String(index + 1).padStart(2, "0")}</span>
      <h3>${escapeHtml(row.name)}</h3>
      <strong>${formatMarketCap(row.marketSum)}</strong>
      <p>${row.count}개 상품 · 평균 <span class="${rateClass(row.avgRate)}">${formatRate(row.avgRate)}</span></p>
    </button>
  `).join("") || `<div class="empty-cell">조회 결과가 없습니다.</div>`;
}

function renderMarketCards() {
  const rows = groupStats(state.filtered, "market").sort((a, b) => b.marketSum - a.marketSum);
  el.marketCards.innerHTML = rows.map(row => {
    const meta = Object.values(MARKET_META).find(item => item.label === row.name);
    return `<button class="market-tile" type="button" data-market="${escapeHtml(row.name)}">
      <div class="tile-top"><span style="color:${meta?.color || "#82908b"}">● ${escapeHtml(row.name)}</span><span>${row.count}개</span></div>
      <h3>평균 등락률</h3>
      <strong class="${rateClass(row.avgRate)}">${formatRate(row.avgRate)}</strong>
      <p>시가총액 ${formatMarketCap(row.marketSum)}</p>
    </button>`;
  }).join("") || `<div class="empty-cell">조회 결과가 없습니다.</div>`;
}

function renderProductCards() {
  const rows = groupStats(state.filtered, "product").sort((a, b) => PRODUCT_ORDER.indexOf(a.name) - PRODUCT_ORDER.indexOf(b.name));
  el.productCards.innerHTML = rows.map(row => `
    <button class="strategy-tile" type="button" data-product="${escapeHtml(row.name)}">
      <div class="tile-top"><span>STRATEGY</span><span>${row.count}개</span></div>
      <h3>${escapeHtml(row.name)}</h3>
      <strong class="${rateClass(row.avgRate)}">${formatRate(row.avgRate)}</strong>
      <p>거래대금 ${formatTurnover(row.amonut)}</p>
    </button>
  `).join("") || `<div class="empty-cell">조회 결과가 없습니다.</div>`;
}

function sortedItems() {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  return [...state.filtered].sort((a, b) => {
    const left = a[state.sortKey];
    const right = b[state.sortKey];
    if (left == null) return 1;
    if (right == null) return -1;
    if (typeof left === "string") return left.localeCompare(right, "ko") * direction;
    return (left - right) * direction;
  });
}

function renderTable() {
  const items = sortedItems();
  const totalPages = Math.max(1, Math.ceil(items.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const pageItems = items.slice(start, start + state.pageSize);
  el.resultCount.textContent = `${items.length.toLocaleString("ko-KR")}개 종목`;
  el.pageInfo.textContent = `${state.page} / ${totalPages}`;
  el.prevPage.disabled = state.page <= 1;
  el.nextPage.disabled = state.page >= totalPages;

  el.etfTableBody.innerHTML = pageItems.length ? pageItems.map((item, index) => `
    <tr data-code="${item.itemcode}" tabindex="0" aria-label="${escapeHtml(item.itemname)} 상세 보기">
      <td class="rank-cell">${start + index + 1}</td>
      <td><div class="product-name"><span class="product-symbol">${escapeHtml(item.itemname.slice(0, 1))}</span><div><strong title="${escapeHtml(item.itemname)}">${escapeHtml(item.itemname)}</strong><span>${item.itemcode} · ${escapeHtml(item.manager)} · ${escapeHtml(item.market)}</span></div></div></td>
      <td class="data-primary">${formatPrice(item.nowVal)}</td>
      <td class="${rateClass(item.changeRate)}">${formatRate(item.changeRate)}</td>
      <td class="${rateClass(item.threeMonthEarnRate)}">${formatRate(item.threeMonthEarnRate)}</td>
      <td>${formatVolume(item.quant)}</td>
      <td>${formatTurnover(item.amonut)}</td>
      <td class="data-primary">${formatMarketCap(item.marketSum)}</td>
      <td class="${rateClass(item.navGap)}">${formatRate(item.navGap)}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="empty-cell">조건에 맞는 ETF가 없습니다. 필터를 조정해 보세요.</td></tr>`;
}

function renderEmptyState() {
  el.etfTableBody.innerHTML = `<tr><td colspan="9" class="empty-cell">ETF 데이터를 표시할 수 없습니다.</td></tr>`;
}

function showDetail(code) {
  const item = state.items.find(row => row.itemcode === code);
  if (!item) return;
  el.drawerContent.innerHTML = `
    <p class="drawer-kicker">ETF DETAIL · ${item.itemcode}</p>
    <h2 id="drawerTitle" class="drawer-title">${escapeHtml(item.itemname)}</h2>
    <div class="drawer-meta"><span>${escapeHtml(item.manager)}</span><span>${escapeHtml(item.market)}</span><span>${escapeHtml(item.product)}</span></div>
    <div class="drawer-price">
      <small>현재가</small><strong>${formatPrice(item.nowVal)}</strong>
      <p class="${rateClass(item.changeRate)}">전일 대비 ${formatRate(item.changeRate)} · ${item.changeVal > 0 ? "+" : ""}${item.changeVal.toLocaleString("ko-KR")}원</p>
    </div>
    <div class="drawer-stats">
      <div class="drawer-stat"><span>3개월 수익률</span><strong class="${rateClass(item.threeMonthEarnRate)}">${formatRate(item.threeMonthEarnRate)}</strong></div>
      <div class="drawer-stat"><span>NAV</span><strong>${formatPrice(item.nav)}</strong></div>
      <div class="drawer-stat"><span>NAV 괴리율</span><strong class="${rateClass(item.navGap)}">${formatRate(item.navGap)}</strong></div>
      <div class="drawer-stat"><span>시가총액</span><strong>${formatMarketCap(item.marketSum)}</strong></div>
      <div class="drawer-stat"><span>거래량</span><strong>${formatVolume(item.quant)}</strong></div>
      <div class="drawer-stat"><span>거래대금</span><strong>${formatTurnover(item.amonut)}</strong></div>
    </div>
    <a class="drawer-link" href="https://finance.naver.com/item/main.naver?code=${encodeURIComponent(item.itemcode)}" target="_blank" rel="noopener noreferrer">네이버 금융에서 상세 보기 ↗</a>
  `;
  el.drawerBackdrop.hidden = false;
  el.detailDrawer.classList.add("open");
  el.detailDrawer.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  el.closeDrawer.focus();
}

function closeDetail() {
  el.detailDrawer.classList.remove("open");
  el.detailDrawer.setAttribute("aria-hidden", "true");
  el.drawerBackdrop.hidden = true;
  document.body.style.overflow = "";
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".view-tab").forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll(".analysis-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === view));
}

function resetFilters() {
  el.searchInput.value = "";
  el.managerFilter.value = "all";
  el.marketFilter.value = "all";
  el.productFilter.value = "all";
  applyFilters();
}

document.querySelectorAll(".view-tab").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
[el.managerFilter, el.marketFilter, el.productFilter].forEach(select => select.addEventListener("change", () => applyFilters()));
el.searchInput.addEventListener("input", () => applyFilters());
el.resetFilters.addEventListener("click", resetFilters);
el.refreshButton.addEventListener("click", () => fetchData());
el.pageSize.addEventListener("change", () => { state.pageSize = Number(el.pageSize.value); state.page = 1; renderTable(); });
el.prevPage.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; renderTable(); } });
el.nextPage.addEventListener("click", () => { state.page += 1; renderTable(); });
el.closeDrawer.addEventListener("click", closeDetail);
el.drawerBackdrop.addEventListener("click", closeDetail);

document.querySelector("thead").addEventListener("click", event => {
  const button = event.target.closest("button[data-sort]");
  if (!button) return;
  if (state.sortKey === button.dataset.sort) state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
  else { state.sortKey = button.dataset.sort; state.sortDirection = button.dataset.sort === "itemname" ? "asc" : "desc"; }
  document.querySelectorAll("th button[data-sort]").forEach(item => item.classList.remove("sorted", "asc", "desc"));
  button.classList.add("sorted", state.sortDirection);
  renderTable();
});

document.addEventListener("click", event => {
  const detailButton = event.target.closest("[data-detail]");
  const row = event.target.closest("tr[data-code]");
  const manager = event.target.closest("[data-manager]");
  const market = event.target.closest("[data-market]");
  const product = event.target.closest("[data-product]");
  if (detailButton) showDetail(detailButton.dataset.detail);
  else if (row) showDetail(row.dataset.code);
  else if (manager) { el.managerFilter.value = manager.dataset.manager; setView("overview"); applyFilters(); }
  else if (market) { el.marketFilter.value = market.dataset.market; setView("overview"); applyFilters(); }
  else if (product) { el.productFilter.value = product.dataset.product; setView("overview"); applyFilters(); }
});

document.addEventListener("keydown", event => {
  if (event.key === "/" && document.activeElement?.tagName !== "INPUT") { event.preventDefault(); el.searchInput.focus(); }
  if (event.key === "Escape") closeDetail();
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("tr[data-code]")) { event.preventDefault(); showDetail(event.target.dataset.code); }
});

setInterval(() => {
  state.countdown -= 1;
  if (state.countdown <= 0) fetchData({ silent: true });
  el.countdown.textContent = Math.max(0, state.countdown);
}, 1000);

fetchData();
