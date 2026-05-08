const themeToggle = document.getElementById("themeToggle")

const tbody = document.getElementById("assetTableBody")

const totalBalance = document.getElementById("totalBalance")
const totalPercentChange = document.getElementById("totalPercentChange")
const totalAssets = document.getElementById("totalAssets")

const chartBox = document.getElementById("chartBox")
const ctx = document.getElementById("portfolioChart")

const symbolInput = document.getElementById("symbolInput")
const amountInput = document.getElementById("amountInput")
const addBtn = document.getElementById("addBtn")
const searchResults = document.getElementById("searchResults")



const emptyChart = document.createElement("h1")
emptyChart.classList.add("centered")
emptyChart.textContent = "No chart loaded"
chartBox.appendChild(emptyChart)

/* localStorage.removeItem("assets") */ 
/* localStorage.clear() */

let assets = []

let coinList = []
let filteredCoins = []
let selectedCoinId = null
let debounceTimer = null
let selectedCoin = null

let isCoinListLoaded = false

let chart = null

let lastPriceData = null

/* LOAD COIN LIST */
async function loadCoinList() {
    try {
        const cached = localStorage.getItem("coinList")
        const cachedTime = localStorage.getItem("coinListTime")

        const oneDay = 24 * 60 * 60 * 1000

        if (cached && cachedTime) {
            const isExpired = Date.now() - Number(cachedTime) > oneDay

            if (!isExpired) {
                coinList = JSON.parse(cached)
                isCoinListLoaded = true
                console.log("already fetched");
                return
            } else {
                console.log("Cached Expired, refetching");
            }
            
        }

        console.log("Fetching fresh coins")

        const res = await fetch("https://api.coingecko.com/api/v3/coins/list")

        if (!res.ok) {
            throw new Error(`HTTP error: ${res.status}`);
        }

        const data = await res.json()

        localStorage.setItem("coinList", JSON.stringify(data))
        localStorage.setItem("coinListTime", Date.now())

        coinList = data

        isCoinListLoaded = true

        if (symbolInput.value.trim()) {
            symbolInput.dispatchEvent(new Event("input"))
        }
    }
    catch(error) {
        console.log("failed to load coin list");

        searchResults.innerHTML = `<div class="search-item">Failed to load coins.</div>`
    }
}


/* LISTEN TO INPUT TYPING */
symbolInput.addEventListener("input", () => {
    selectedCoinId = null
    selectedCoin = null

    if (!isCoinListLoaded) {
        searchResults.innerHTML = `<div class="search-item loading">🔄️ Loading coins...</div>`
        return
    }

    const query = symbolInput.value.toLowerCase().trim()

    clearTimeout(debounceTimer)

    if(!query) {
        searchResults.innerHTML = ""
        return
    }

    debounceTimer = setTimeout(() => {
        filteredCoins = coinList.filter(coin =>
            coin.id.includes(query) || coin.symbol.includes(query) || coin.name.toLowerCase().includes(query)
        ).slice(0, 10)
        renderSearchResults()
    }, 300)
})


/* RENDER INPUT SEARCH RESULTS */

function renderSearchResults() {
    searchResults.innerHTML = ""

    if (filteredCoins.length === 0) {
        searchResults.innerHTML = `<div class="search-item">No results found</div>`
        return
    }

    filteredCoins.forEach(coin => {
        const div = document.createElement("div")

        div.className = "search-item"

        div.textContent = `${coin.name} (${coin.symbol.toUpperCase()})`

        div.onclick = () => {
            selectCoin(coin)
        }

        searchResults.appendChild(div)
    })
}



/* SELECT COIN FROM DROPDOWN */
function selectCoin(coin) {
    symbolInput.value = `${coin.name} (${coin.symbol.toUpperCase()})`
    selectedCoinId = coin.id
    selectedCoin = coin

    symbolInput.style.borderColor = "var(--COLOR-PROFIT)"
    searchResults.innerHTML = ""
}





/* RENDER FUNCTION */
function renderCrypto (assets, priceData) {
    if (!priceData) {
        tbody.innerHTML = `<tr><td colspan="6">Error Loading data</td></tr>`
        return
    }

    assets.forEach(asset => {
        const data = priceData[asset.symbol]

        const row = document.createElement("tr")

        if (!data) {
            row.innerHTML = `<td colspan="6"></td>`
            tbody.appendChild(row)
            return
        }

        const price = data.usd
        const change = data.usd_24h_change
        const value = price * asset.amount

        row.innerHTML = `
        <td>${asset.name}</td>
        <td>$${price.toLocaleString()}</td>
        <td>${asset.amount}</td>
        <td>$${value.toLocaleString()}</td>
        <td class="${change >= 0 ? "profit" : "loss"}">
            ${change.toFixed(2)}%</td>
        <td onclick="removeAsset('${asset.symbol}')" style="cursor: pointer">❌</td>`

        tbody.appendChild(row)
    })    
}




function removeAsset (symbol) {
    assets = assets.filter(a => a.symbol !== symbol)
    saveAssets()
    
    tbody.innerHTML = ""
    if (assets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">No assets added yet</td></tr>`
    }
    renderCrypto(assets, lastPriceData)
    updateSummary(lastPriceData)
    updateChart()
}




/*LOAD ASSET FUNCTION */
function  loadAssets () {
    const saved = localStorage.getItem("assets")

    if (saved) {
        assets = JSON.parse(saved)
    }
}



/* SAVE ASSET FUNCTION */
function saveAssets() {
    localStorage.setItem("assets", JSON.stringify(assets))
}



/* ADD ASSET FUNCTION */
function addAsset(selectedCoin, amount) {
    if (!selectedCoin) return

    if (amount <= 0 || !amount) {
        alert("Invalid amount")
        return
    }
    
    const existing = assets.find(a => a.symbol === selectedCoin.id)


    if (existing) {
        existing.amount += amount
    } else {
        assets.push({symbol: selectedCoin.id, name: selectedCoin.name, amount})
    }

    saveAssets()
    
    if (!lastPriceData || !lastPriceData[selectedCoin.id]) {
        console.log("1");
        updateUI()
    } else {
        console.log("2");
        tbody.innerHTML = ""
        renderCrypto(assets, lastPriceData)
        updateSummary(lastPriceData)
        updateChart()
    }
}



/* ADD ASSET BUTTON EVENT LISTENER */
addBtn.addEventListener("click", () => {
    const amount = parseFloat(amountInput.value)

    if (!selectedCoinId) {
        alert("Select a coin from the list")
        return
    }

    addBtn.disabled = true

    addAsset(selectedCoin, amount)

    symbolInput.value = ""
    amountInput.value = ""
    selectedCoinId = null


    setTimeout(() => {
        addBtn.disabled = false
    }, 300)

    symbolInput.style.borderColor = ""
})





/* UPDATE SUMMARY OF COINS */
function updateSummary(priceData) {
    let totalValue = 0
    let totalChange = 0

    assets.forEach(asset => {
        const data = priceData[asset.symbol]

        if (!data) return

        const value = data.usd * asset.amount

        totalValue += value

        totalChange += (data.usd_24h_change / 100) * value
    })

    const percentChange = totalValue ? (totalChange / totalValue) * 100 : 0

    totalBalance.textContent = `$${totalValue.toLocaleString()}`

    totalPercentChange.textContent = `${percentChange.toFixed(3)}%`

    totalAssets.textContent = assets.length
}





function updateChart() {
    if (!assets.length || !lastPriceData) {
        if (chart) {
            chart.destroy()
            chart = null
        }

        if (!chartBox.contains(emptyChart)) {
            chartBox.appendChild(emptyChart)
        }
        return
    }

    if (chartBox.contains(emptyChart)) {
        chartBox.removeChild(emptyChart)
    }
    

    const items = assets.map(asset => {
        const data = lastPriceData[asset.symbol]

        if (!data) return null

        return {
            name: asset.name,
            value: data.usd * asset.amount
        }
    }).filter(Boolean)

    const total = items.reduce((sum, item) => sum + item.value, 0)

    if (total === 0) return

    items.sort((a, b) => b.value - a.value)

    const top = items.slice(0, 3)

    const others = items.slice(3).reduce((sum, item) => sum + item.value, 0)

    if (others > 0) {
        top.push({ name: "Others", value: others })
    }

    const labels = top.map(item => item.name)

    const percentages = top.map(item => ((item.value / total) * 100).toFixed(1))

    if (chart) chart.destroy()

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "% of portfolio",
                data: percentages,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: value => value.toFixed(1) + "%"
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    })
}





/* UPDATE UI */
async function updateUI() {
    console.log("Entered update UI");
    if (assets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6">No assets added yet</td></tr>`

        totalBalance.textContent = "$0"
        totalPercentChange.textContent = "0.00%"
        totalAssets.textContent = "0"

        
        updateChart()

        if (!chartBox.contains(emptyChart)) {
            chartBox.appendChild(emptyChart)
        }
        return
    }


    tbody.innerHTML = `<tr class="loading"><td colspan="6">Loading your coins...</td></tr>`
    totalBalance.textContent = "Loading..."
    totalPercentChange.textContent = "..."
    totalAssets.textContent = "..."
  
    totalBalance.classList.add("loading")
    totalPercentChange.classList.add("loading")
    totalAssets.classList.add("loading")

    const symbols = assets.map(a => a.symbol)

    const result = await fetchPrice(symbols)
    
    if (result.data) {
        console.log("loading from online data");
        lastPriceData = result.data

        removeSummaryLoading()

        tbody.innerHTML = ""
        renderCrypto(assets, lastPriceData)

        updateSummary(lastPriceData)
        updateChart()
    }
    else if (lastPriceData) {
        console.log("loading from last price data");
        
        removeSummaryLoading()
        tbody.innerHTML = showError(result.error)

        renderCrypto(assets, lastPriceData)
        updateSummary(lastPriceData)
        updateChart()
    } else {
        console.log("no previous data");

        totalBalance.textContent = "$0"
        totalPercentChange.textContent = "0.00%"
        totalAssets.textContent = "0"

        updateChart()
        removeSummaryLoading()
        console.log(result.error);
        tbody.innerHTML = showError(result.error)
    }
}




/* FETCH FUNCTION */
async function fetchPrice(symbols) {
    try {
        const ids = [...new Set(symbols)].join(",")

        if (!ids) {
            return {error: "NO_IDS"}
        }

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`

        const res = await fetch(url)
        console.log(res.status);

        if (!res.ok) {
            console.log(res.status);
            switch (res.status) {
                case 400:
                    return {
                        error: "BAD_REQUEST"
                    }
                case 401:
                    return {
                        error: "UNAUTHORIZED"
                    }
                case 403:
                    return {
                        error: "FORBIDDEN"
                    }
                case 404:
                    return {
                        error: "NOT_FOUND"
                    }
                case 408:
                    return {
                        error: "TIMEOUT"
                    }
                case 429:
                    return {
                        error: "RATE_LIMIT"
                    }
                case 500:
                    return {
                        error: "SERVER_ERROR"
                    }
                case 503:
                    return {
                        error: "SERVICE_UNAVAILABLE"
                    }
            
                default:
                    return {
                        error: "UNKNOWN_HTTP"
                    }
            }
        }

        const data = await res.json()

        if (!data || Object.keys(data).length === 0) {
            return {error: "EMPTY_DATA"}
        }

        return {data}
    }
    catch (error) {
        console.log("Error fetching")

        if (error instanceof TypeError) {
            return { error: "FETCH_FAILED"}
        }

        return {error: "UNKNOWN_ERROR"}
    }
}






/* THE INITIALISER */
async function init() {
    loadAssets()
    await loadCoinList()
    updateUI()
}


init()

/* setInterval(() => {
    if (assets.length > 0) {
        updateUI()
    }
}, 30000) */




function showError(errorType) {
    let message = "Failed to load prices"

    switch (errorType) {
        case "FETCH_FAILED":
            message = "Unable to fetch, failed. Try again in a while"
            break
        case "OFFLINE":
            message = "No internet connection"
            break
        case "RATE_LIMIT":
            message = "Too many requests. Wait a while. Refreshing won't help"
            console.log("TOO MANY ATTEMPTS");
            break
        case "NETWORK_ERROR":
            message = "Network error. Check your internet"
            break
        case "SERVER_ERROR":
            message = "CoinGecko server error. Try again later"
            break
        case "SERVICE_UNAVAILABLE":
            message = "CoinGecko is under maintenance"
            break
        case "NOT_FOUND":
            message = "Requested coin data not found"
            break
    }

    return `<tr><td colspan="6">${message}</td></tr>`
}





function removeSummaryLoading() {
    totalBalance.classList.remove("loading")
    totalPercentChange.classList.remove("loading")
    totalAssets.classList.remove("loading")
}



















/* THEME CHANGE */
const savedTheme = localStorage.getItem("theme")

if (savedTheme === "light") {
    document.documentElement.setAttribute("data-theme", "light")
    themeToggle.textContent = "☀️"
}

themeToggle.addEventListener("click", () => {
    const isLight = document.documentElement.getAttribute("data-theme") === "light"

    if (isLight) {
        document.documentElement.removeAttribute("data-theme")
        localStorage.setItem ("theme", "dark")
        themeToggle.textContent = "🌙"
    } else {
        document.documentElement.setAttribute("data-theme", "light")
        localStorage.setItem("theme", "light")
        themeToggle.textContent = "☀️"
    }
})
