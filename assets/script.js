const API_BASE = "https://api.coingecko.com/api/v3";

function formatTime(date) {
  return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

async function fetchTopCryptos() {
  const url = `${API_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.map(formatCoinData);
  } catch (err) {
    console.error("Error fetching top cryptos:", err);
    return [];
  }
}

async function fetchWatchlistCryptos(ids) {
  if (!ids.length) return [];
  const url = `${API_BASE}/coins/markets?vs_currency=usd&ids=${ids.join(',')}&sparkline=false`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.map(formatCoinData);
  } catch (err) {
    console.error("Error fetching watchlist cryptos:", err);
    return [];
  }
}

function formatCoinData(coin) {
  return {
    id: coin.id,
    name: coin.name,
    symbol: coin.symbol.toUpperCase(),
    price: `$${coin.current_price.toLocaleString()}`,
    change: coin.price_change_percentage_24h?.toFixed(2) ?? "0",
    image: coin.image
  };
}

function renderCards(containerId, assets, showWatchlistButton = true) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  if (!assets.length) {
    container.innerHTML = `<p class="text-gray-500">No data available.</p>`;
    return;
  }

  assets.forEach(asset => {
    const changeColor = asset.change >= 0 ? "text-green-500" : "text-red-500";

    container.innerHTML += `
      <div class="bg-white rounded-2xl shadow-md hover:shadow-lg transition duration-300 p-5 w-full max-w-md mx-auto mb-5">
        <div class="flex items-center gap-4">
          <img src="${asset.image}" alt="${asset.name}" class="w-12 h-12 rounded-full shadow-sm" />
          <div>
            <h3 class="text-lg font-semibold text-gray-800">${asset.name}</h3>
            <p class="text-sm text-gray-500 uppercase">${asset.symbol}</p>
          </div>
        </div>
        
        <div class="mt-4">
          <p class="text-xl font-bold text-gray-900">${asset.price}</p>
          <p class="${changeColor} text-sm font-medium mt-1">${asset.change}% (24h)</p>
        </div>

        <div class="mt-4 flex items-center justify-between">
          <a href="details.html?id=${asset.id}" class="text-blue-600 text-sm hover:underline">📊 View Details</a>
          ${showWatchlistButton 
            ? `<button onclick="addToWatchlist('${asset.id}')" class="text-sm text-blue-500 hover:underline">+ Add to Watchlist</button>` 
            : `<button onclick="removeFromWatchlist('${asset.id}')" class="text-sm text-red-500 hover:underline">✖ Remove</button>`
          }
        </div>
      </div>
    `;
  });

  const lastUpdated = document.getElementById("last-updated");
  if (lastUpdated) {
    lastUpdated.innerText = `Last updated: ${formatTime(new Date())}`;
  }
}


// WATCHLIST functions
function getWatchlist() {
  return JSON.parse(localStorage.getItem("watchlist") || "[]");
}

function addToWatchlist(id) {
  let watchlist = getWatchlist();
  if (!watchlist.includes(id)) {
    watchlist.push(id);
    localStorage.setItem("watchlist", JSON.stringify(watchlist));
    alert("Added to Watchlist!");
  } else {
    alert("Already in Watchlist!");
  }
}

function removeFromWatchlist(id) {
  let watchlist = getWatchlist();
  watchlist = watchlist.filter(item => item !== id);
  localStorage.setItem("watchlist", JSON.stringify(watchlist));
  location.reload();
}

// MAIN
async function loadPageData() {
  if (location.pathname.includes("index.html")) {
    const data = await fetchTopCryptos();
    renderCards("market-data", data, true);
    setInterval(async () => {
      const newData = await fetchTopCryptos();
      renderCards("market-data", newData, true);
    }, 60000);
  }

  if (location.pathname.includes("watchlist.html")) {
    const ids = getWatchlist();
    const data = await fetchWatchlistCryptos(ids);
    renderCards("watchlist-data", data, false);
    setInterval(async () => {
      const ids = getWatchlist();
      const newData = await fetchWatchlistCryptos(ids);
      renderCards("watchlist-data", newData, false);
    }, 60000);
  }
}

document.addEventListener("DOMContentLoaded", loadPageData);


// Load details page
async function loadCoinDetails() {
  const params = new URLSearchParams(window.location.search);
  const coinId = params.get("id");

  const title = document.getElementById("coin-title");
  const infoBox = document.getElementById("coin-info");

  if (!coinId) {
    title.innerText = "Coin not found.";
    return;
  }

  title.innerText = `Loading ${coinId}...`;

  try {
    const [infoRes, chartRes] = await Promise.all([
      fetch(`${API_BASE}/coins/${coinId}`),
      fetch(`${API_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=daily`)
    ]);

    const info = await infoRes.json();
    const chart = await chartRes.json();

    title.innerText = `${info.name} (${info.symbol.toUpperCase()})`;

    const prices = chart.prices.map(p => p[1]);
    const labels = chart.prices.map(p => {
      const d = new Date(p[0]);
      return `${d.getDate()}/${d.getMonth() + 1}`;
    });

    const ctx = document.getElementById("priceChart").getContext("2d");
    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Price (USD)",
          data: prices,
          backgroundColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "#3b82f6",
          borderWidth: 2,
          pointRadius: 3,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `$${ctx.raw.toLocaleString()}`
            }
          }
        },
        scales: {
          x: { display: true, title: { display: true, text: 'Date' }},
          y: { display: true, title: { display: true, text: 'Price (USD)' }}
        }
      }
    });

    // Populate coin info
    infoBox.innerHTML = `
      <div><strong>Current Price:</strong> $${info.market_data.current_price.usd.toLocaleString()}</div>
      <div><strong>Market Cap:</strong> $${info.market_data.market_cap.usd.toLocaleString()}</div>
      <div><strong>24h High:</strong> $${info.market_data.high_24h.usd.toLocaleString()}</div>
      <div><strong>24h Low:</strong> $${info.market_data.low_24h.usd.toLocaleString()}</div>
      <div><strong>Total Volume:</strong> $${info.market_data.total_volume.usd.toLocaleString()}</div>
      <div><strong>Coin Rank:</strong> ${info.market_cap_rank}</div>
      <div><strong>Homepage:</strong> <a href="${info.links.homepage[0]}" class="text-blue-600 hover:underline" target="_blank">${info.links.homepage[0]}</a></div>
    `;

  } catch (err) {
    console.error("Error loading coin details:", err);
    title.innerText = "Error loading data.";
    infoBox.innerHTML = `<p class="text-red-500">Unable to fetch data. Please try again later.</p>`;
  }
}

if (location.pathname.includes("details.html")) {
  document.addEventListener("DOMContentLoaded", loadCoinDetails);
}
