console.log('app.js yüklendi');

// Global data değişkeni
let data = null;

// Loading div'ini oluştur
const loadingDiv = d3.select("#chart")
    .append("div")
    .attr("class", "loading")
    .text("Veriler yükleniyor...");

// Update visualization fonksiyonu
async function updateVisualization() {
    loadingDiv.style("display", "block");
    
    try {
        const newData = await fetchStockData();
        if (newData) {
            data = newData;
            loadingDiv.style("display", "none");
            redraw();
        } else {
            loadingDiv.text("Veri yüklenemedi. Tekrar deneniyor...");
            setTimeout(updateVisualization, 5000);
        }
    } catch (error) {
        console.error('Güncelleme hatası:', error);
        loadingDiv.text("Veri yüklenemedi. Tekrar deneniyor...");
        setTimeout(updateVisualization, 5000);
    }
}

let chartDiv = document.getElementById("chart");
let svg = d3.select(chartDiv).append("svg");

// Format numbers with Turkish locale
let format = d3.format(",.2f"); // İki ondalık basamak ve binlik ayracı

let colors = [
    "#AA2121",
    "#C84040",
    "#ED7171",
    "#7EC17E",
    "#518651",
    "#215E2C"
];

function getColor(val) {
    // Daha hassas renk aralıkları
    if (val <= -3) return colors[0];      // Koyu kırmızı
    if (val <= -1) return colors[1];      // Açık kırmızı
    if (val < 0) return colors[2];        // Çok açık kırmızı
    if (val === 0) return "#666666";      // Nötr gri
    if (val <= 1) return colors[3];       // Açık yeşil
    if (val <= 3) return colors[4];       // Yeşil
    return colors[5];                     // Koyu yeşil
}

var tooltip = d3.select("#chart").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

// Global değişkenlere sektör filtresi ekleyelim
let currentSector = 'all';

// Sektör seçimi event listener'ı
document.getElementById('sectorFilter').addEventListener('change', async function(e) {
    currentSector = e.target.value;
    
    // Loading göster
    loadingDiv.style("display", "block");
    
    try {
        await updateVisualization();
        console.log(`Sector changed to ${currentSector}`);
    } catch (error) {
        console.error('Error updating sector:', error);
        loadingDiv.text("Veri güncellenirken hata oluştu");
    }
});

function redraw() {
    if (!data) return;
    
    // Container boyutlarını al
    const containerRect = chartDiv.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // SVG'yi temizle ve yeniden boyutlandır
    const svg = d3.select("svg")
        .attr("width", width)
        .attr("height", height)
        .html("");

    // Treemap layout'u güncelle
    const treemap = d3.treemap()
        .size([width, height])
        .paddingOuter(3)
        .paddingTop(19)
        .paddingInner(2)
        .round(true);

    // Hierarchy oluştur
    const root = d3.hierarchy(data)
        .sum(d => d.volume)
        .sort((a, b) => {
            if (currentSector === 'all') {
                if (a.depth === 1 && b.depth === 1) {
                    const orderA = sectorOrder[a.data.name] || 998;
                    const orderB = sectorOrder[b.data.name] || 998;
                    return orderA - orderB;
                }
            }
            return b.value - a.value;
        });

    // Treemap layout'u uygula
    treemap(root);

    // Grupları oluştur ve tooltip ekle
    const leaf = svg.selectAll("g")
        .data(root.leaves())
        .enter()
        .append("g")
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .on("mousemove", function(d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`
                <div class="tooltip-body">
                    <ul>
                        <li>Şirket: ${d.data.fullName}</li>
                        <li>Sektör: ${d.parent.data.name}</li>
                        <li>Fiyat: ₺${format(d.data.price)}</li>
                        <li>Değişim: %${d.data.pc > 0 ? '+' : ''}${d.data.pc.toFixed(2)}</li>
                        <li>Hacim: ₺${format(d.data.volume)}</li>
                    </ul>
                </div>
            `)
            .style("left", (d3.event.pageX + 10) + "px")
            .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

    // Dikdörtgenleri çiz
    leaf.append("rect")
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => getColor(d.data.pc));

    // Metinleri ekle
    const text = leaf.append("text")
        .attr("class", "treemap-text")
        .attr("text-anchor", "middle")  // Metni merkeze al
        .attr("fill", "#fff")          // Beyaz renk
        .attr("y", d => (d.y1 - d.y0) / 2)  // Dikey ortalama
        .attr("x", d => (d.x1 - d.x0) / 2)  // Yatay ortalama
        .attr("font-size", d => Math.min(d.x1 - d.x0, d.y1 - d.y0) / 6);  // Dinamik font boyutu

    // Hisse kodu
    text.append("tspan")
        .attr("class", "symbol")
        .attr("x", d => (d.x1 - d.x0) / 2)
        .attr("dy", "-1.2em")
        .text(d => d.data.name);

    // Fiyat
    text.append("tspan")
        .attr("class", "price")
        .attr("x", d => (d.x1 - d.x0) / 2)
        .attr("dy", "1.2em")
        .text(d => `₺${format(d.data.price)}`);

    // Değişim yüzdesi
    text.append("tspan")
        .attr("class", "change")
        .attr("x", d => (d.x1 - d.x0) / 2)
        .attr("dy", "1.2em")
        .text(d => `${d.data.pc > 0 ? '+' : ''}${d.data.pc.toFixed(2)}%`);

    // Sektör başlıkları
    svg.selectAll("titles")
        .data(root.descendants().filter(d => d.depth === 1))
        .enter()
        .append("text")
        .attr("class", "sector-title")
        .attr("x", d => d.x0 + 5)
        .attr("y", d => d.y0 + 15)
        .text(d => d.data.name);
}

// Pencere boyutu değiştiğinde yeniden çiz
window.addEventListener("resize", () => {
    requestAnimationFrame(redraw);
});

// Draw for the first time to initialize.
redraw();

// ZOOM Function
var instance = panzoom(document.getElementById("chart"), {
    zoomSpeed: 0.06,
    maxZoom: 20,
    minZoom: 1
});

instance.on("panstart", function (e) {
    console.log("Fired when pan is just started ", e);
    // Note: e === instance.
});

instance.on("pan", function (e) {
    console.log("Fired when the scene is being panned", e);
});

instance.on("panend", function (e) {
    console.log("Fired when pan ended", e);
});

instance.on("zoom", function (e) {
    console.log("Fired when scene is zoomed", e);
});

instance.on("transform", function (e) {
    // This event will be called along with events above.
    console.log("Fired when any transformation has happened", e);
});

// Sektör sıralaması için sabit
const sectorOrder = {
    "Bankacılık": 1,
    "Sanayi": 2,
    "Ulaştırma": 3,
    "Holding": 4,
    "Teknoloji": 5,
    "Enerji": 6,
    "Gayrimenkul": 7,
    "Perakende": 8,
    "Madencilik": 9,
    "Gıda": 10
};

// Hisse senetleri ve sektörleri
const stockSectors = {
    'AKBNK': 'Bankacılık',
    'GARAN': 'Bankacılık',
    'ISCTR': 'Bankacılık',
    'YKBNK': 'Bankacılık',
    'VAKBN': 'Bankacılık',
    'HALKB': 'Bankacılık',
    'SKBNK': 'Bankacılık',
    'ALBRK': 'Bankacılık',
    'ICBCT': 'Bankacılık',
    'QNBFK': 'Bankacılık',
    'TSKB': 'Bankacılık',
    'KLNMA': 'Bankacılık',
    
    // Sigorta
    'TURSG': 'Sigorta',
    'ANSGR': 'Sigorta',
    'AKGRT': 'Sigorta',
    'ANHYT': 'Sigorta',
    'AGESA': 'Sigorta',
 
    //* Holding
    'KCHOL': 'Holding',
    'SAHOL': 'Holding',
    'SISE': 'Holding',
    'DOHOL': 'Holding',
    'TAVHL': 'Holding',
    'TKFEN': 'Holding',
    'PEHOL': 'Holding',
    'AGHOL': 'Holding',
    'GLYHO': 'Holding',
    'GSDHO': 'Holding',
    'NTHOL': 'Holding',
    'ALARK': 'Holding',
    'AYKHO': 'Holding',
    'INVEO': 'Holding',
    
    // Sanayi
    'ASELS': 'Sanayi',
    'TOASO': 'Sanayi',
    'TUPRS': 'Sanayi',
    'EREGL': 'Sanayi',
    'KRDMD': 'Sanayi',
    'KRDMA': 'Sanayi',
    'KRDMB': 'Sanayi',
    'SASA': 'Sanayi',
    'CEMTS': 'Sanayi',
    'CIMSA': 'Sanayi',
    'OYAKC': 'Sanayi',
    'AKCNS': 'Sanayi',
    'BUCIM': 'Sanayi',
    'BTCIM': 'Sanayi',
    'NUHCM': 'Sanayi',
    
    // Teknoloji
    'LOGO': 'Teknoloji',
    'ARENA': 'Teknoloji',
    'ARDYZ': 'Teknoloji',
    'FONET': 'Teknoloji',
    'KFEIN': 'Teknoloji',
    'NETAS': 'Teknoloji',
    'INDES': 'Teknoloji',
    'KAREL': 'Teknoloji',
    
    // Telekomünikasyon
    'TCELL': 'Telekomünikasyon',
    'TTKOM': 'Telekomünikasyon',
    
    // Perakende
    'MGROS': 'Perakende',
    'BIMAS': 'Perakende',
    'SOKM': 'Perakende',
    'CRFSA': 'Perakende',
    'VAKKO': 'Perakende',
    
    // Enerji
    'AYDEM': 'Enerji',
    'AKENR': 'Enerji',
    'AKSEN': 'Enerji',
    'AKSA': 'Enerji',
    'ZOREN': 'Enerji',
    'ODAS': 'Enerji',
    'EUPWR': 'Enerji',
    'CONSE': 'Enerji',
    'NATEN': 'Enerji',
    'AKFYE': 'Enerji',
    'GWIND': 'Enerji',
    'KARYE': 'Enerji',
    'HUNER': 'Enerji',
    'YEOTK': 'Enerji',
    'ENJSA': 'Enerji',
    'AYEN': 'Enerji',
    
    // Gıda
    'BANVT': 'Gıda',
    'CCOLA': 'Gıda',
    'KERVT': 'Gıda',
    'PETUN': 'Gıda',
    'TATGD': 'Gıda',
    'ULKER': 'Gıda',
    'YAPRK': 'Gıda',
    'GOKNR': 'Gıda',
    'SELVA': 'Gıda',
    'SOKE': 'Gıda',
    'TUKAS': 'Gıda',
    'ATAKP': 'Gıda',
    'KUVVA': 'Gıda',
    'KNFRT': 'Gıda',
    'PNSUT': 'Gıda',
    'PINSU': 'Gıda',
    'VANGD': 'Gıda',
    'AEFES': 'Gıda',
    'ULUUN': 'Gıda',
    'TBORG': 'Gıda',
    
    // Otomotiv
    'FROTO': 'Otomotiv',
    'TOASO': 'Otomotiv',
    'ARCLK': 'Otomotiv',
    'BFREN': 'Otomotiv',
    'DOAS': 'Otomotiv',
    'KARSN': 'Otomotiv',
    'OTKAR': 'Otomotiv',
    'TTRAK': 'Otomotiv',
    'ASUZU': 'Otomotiv',
    'TMSN': 'Otomotiv',
    'BRYAT': 'Otomotiv',
    'KLMSN': 'Otomotiv',
    
    // İnşaat ve Gayrimenkul
    'EKGYO': 'İnşaat ve Gayrimenkul',
    'ENKAI': 'İnşaat ve Gayrimenkul',
    'ISGYO': 'İnşaat ve Gayrimenkul',
    'KLGYO': 'İnşaat ve Gayrimenkul',
    'PEKGY': 'İnşaat ve Gayrimenkul',
    'RYGYO': 'İnşaat ve Gayrimenkul',
    'VKGYO': 'İnşaat ve Gayrimenkul',
    'MSGYO': 'İnşaat ve Gayrimenkul',
    'DZGYO': 'İnşaat ve Gayrimenkul',
    'SRVGY': 'İnşaat ve Gayrimenkul',
    'TRGYO': 'İnşaat ve Gayrimenkul',
    'MHRGY': 'İnşaat ve Gayrimenkul',
    'TDGYO': 'İnşaat ve Gayrimenkul',
    'OZKGY': 'İnşaat ve Gayrimenkul',
    'HLGYO': 'İnşaat ve Gayrimenkul',
    
    // Spor
    'GSRAY': 'Spor',
    'BJKAS': 'Spor',
    'FENER': 'Spor',
    'TSPOR': 'Spor',
    
    // Havacılık
    'THYAO': 'Havacılık',
    'PGSUS': 'Havacılık',
    
    // Madencilik
    'KOZAA': 'Madencilik',
    'KOZAL': 'Madencilik',
    'IPEKE': 'Madencilik',
    
    // Kimya
    'PETKM': 'Kimya',
    'ALKIM': 'Kimya',
    'BAGFS': 'Kimya',
    'GUBRF': 'Kimya',
    'HEKTS': 'Kimya',
    
    // İlaç
    'ECILC': 'İlaç',
    'MPARK': 'İlaç',
    'SELEC': 'İlaç',
    'DEVA': 'İlaç',
    
    // Tekstil
    'KORDS': 'Tekstil',
    'MAVI': 'Tekstil',
    'YATAS': 'Tekstil',
    'BRMEN': 'Tekstil',
    'SNKRN': 'Tekstil',
    'DESA': 'Tekstil',
    
    // Ulaştırma
    'RYSAS': 'Ulaştırma',
    'CLEBI': 'Ulaştırma',
    
    // Turizm
    'METUR': 'Turizm',
    'MAALT': 'Turizm',
    'AYCES': 'Turizm',
    
    // Medya
    'HURGZ': 'Medya',
    'IHLAS': 'Medya',
    
    // Cam
    'TRKCM': 'Cam',
    'SISE': 'Cam',
    'CGCAM': 'Cam' 
};

// Tarih filtresi için global değişkenler
let currentRange = '1d';
let customStartDate = null;
let customEndDate = null;

// Tarih seçimi event listener'ları
document.getElementById('timeRange').addEventListener('change', async function(e) {
    const value = e.target.value;
    const customDateDiv = document.getElementById('customDateRange');
    
    if (value === 'custom') {
        customDateDiv.style.display = 'flex';
    } else {
        customDateDiv.style.display = 'none';
        currentRange = value;
        
        // Loading göster
        loadingDiv.style("display", "block");
        
        try {
            await updateAll();
            console.log(`Range changed to ${value}, data updated`);
        } catch (error) {
            console.error('Error updating data:', error);
            loadingDiv.text("Veri güncellenirken hata oluştu");
        }
    }
});

document.getElementById('applyCustomDate').addEventListener('click', function() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (startDate && endDate) {
        customStartDate = new Date(startDate);
        customEndDate = new Date(endDate);
        currentRange = 'custom';
        updateAll();
    }
});

// API URL'i boş bırakıyoruz çünkü aynı domain'den servis edilecek
const API_URL = '';

async function fetchStockData() {
    // Seçilen sektöre göre hisseleri filtrele
    const symbols = Object.entries(stockSectors)
        .filter(([_, sector]) => currentSector === 'all' || sector === currentSector)
        .map(([code]) => `${code}.IS`);
    
    const stockData = [];
    
    console.log(`Fetching data with range: ${currentRange} and sector: ${currentSector}`);
    
    // Günlük veri için tarih aralığını ayarla
    if (currentRange === '1d') {
        const today = new Date();
        customStartDate = new Date(today.setHours(0, 0, 0, 0)); // Bugünün başlangıcı
        customEndDate = new Date(today.setHours(23, 59, 59, 999)); // Bugünün sonu
    }
    
    for (const symbol of symbols) {
        try {
            let url = `/api/stock/${symbol}?range=${currentRange}`;
            if (currentRange === 'custom' && customStartDate && customEndDate) {
                url += `&period1=${Math.floor(customStartDate.getTime() / 1000)}`;
                url += `&period2=${Math.floor(customEndDate.getTime() / 1000)}`;
            }
            
            console.log(`Requesting: ${url}`); // Debug log
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.chart.result && data.chart.result[0]) {
                const result = data.chart.result[0];
                const meta = result.meta;
                const stockCode = symbol.replace('.IS', '');
                
                const currentPrice = meta.regularMarketPrice;
                const previousClose = meta.chartPreviousClose;
                const changePercent = ((currentPrice - previousClose) / previousClose) * 100;
                
                // Detaylı debug log
                console.log(`${stockCode} Details:`, {
                    currentPrice,
                    previousClose,
                    changePercent,
                    rawData: meta
                });
                
                stockData.push({
                    code: stockCode,
                    sector: stockSectors[stockCode],
                    text: meta.shortName || meta.symbol,
                    lastprice: currentPrice,
                    rate: changePercent,
                    hacim: meta.regularMarketVolume
                });

                // Eklenen veriyi kontrol et
                console.log(`Added ${stockCode} to stockData:`, stockData[stockData.length - 1]);
            }
        } catch (error) {
            console.error(`Error fetching data for ${symbol}:`, error);
        }
    }
    
    // Debug için tüm stock verilerini gösterelim
    console.log(`All stock data for range ${currentRange}:`, stockData);
    
    // Sektörlere göre grupla
    const sectorGroups = {};
    stockData.forEach(stock => {
        if (!sectorGroups[stock.sector]) {
            sectorGroups[stock.sector] = [];
        }
        sectorGroups[stock.sector].push(stock);
    });
    
    return {
        name: "BIST",
        children: Object.entries(sectorGroups).map(([sector, stocks]) => {
            console.log(`Processing sector ${sector}:`, stocks);
            return {
                name: sector,
                children: stocks.map(stock => {
                    const treeMapItem = {
                        name: stock.code,
                        volume: stock.hacim || 0,
                        value: stock.lastprice || 0,
                        price: stock.lastprice || 0,
                        pc: parseFloat(stock.rate.toFixed(2)) || 0,
                        fullName: stock.text || stock.code
                    };
                    console.log(`TreeMap item for ${stock.code}:`, treeMapItem);
                    return treeMapItem;
                })
            };
        })
    };
}

// XU100 verisi için fonksiyonu güncelle
async function fetchXU100Data() {
    try {
        let url = `/api/xu100?symbol=^XU100&range=${currentRange}`;
        if (currentRange === 'custom' && customStartDate && customEndDate) {
            url += `&period1=${Math.floor(customStartDate.getTime() / 1000)}`;
            url += `&period2=${Math.floor(customEndDate.getTime() / 1000)}`;
        }
        
        console.log('Fetching XU100 data from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.chart.result && data.chart.result[0]) {
            const result = data.chart.result[0];
            const meta = result.meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose;
            const change = ((price - prevClose) / prevClose) * 100;
            const volume = meta.regularMarketVolume;
            
            // Debug log
            console.log('XU100 data:', {
                price,
                prevClose,
                change,
                volume
            });
            
            // UI güncelleme
            const currentElement = document.querySelector('.xu100-data .current');
            if (currentElement) {
                currentElement.textContent = `₺${format(price)}`;
            }
            
            const changeElement = document.querySelector('.xu100-data .change');
            if (changeElement) {
                changeElement.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
            }
            
            const volumeElement = document.querySelector('.xu100-data .volume span');
            if (volumeElement) {
                volumeElement.textContent = `₺${format(volume)}`;
            }
            
            // Son güncelleme zamanı
            const now = new Date();
            const lastUpdate = new Date(meta.regularMarketTime * 1000);
            const lastUpdateElement = document.querySelector('.last-update span');
            if (lastUpdateElement) {
                lastUpdateElement.textContent = 
                    `${lastUpdate.toLocaleDateString('tr-TR')} ${now.toLocaleTimeString('tr-TR')}`;
            }
        }
    } catch (error) {
        console.error('XU100 veri hatası:', error);
        // Hata durumunda UI'ı güncelle
        const elements = {
            current: document.querySelector('.xu100-data .current'),
            change: document.querySelector('.xu100-data .change'),
            volume: document.querySelector('.xu100-data .volume span')
        };

        if (elements.current) elements.current.textContent = 'Hata';
        if (elements.change) elements.change.textContent = '-';
        if (elements.volume) elements.volume.textContent = 'Veri alınamadı';
    }
}

// Reset zoom fonksiyonu
function resetZoom() {
    instance.moveTo(0, 0);
    instance.zoomAbs(0, 0, 1);
}

// Tam ekran geçiş fonksiyonu
function toggleFullscreen() {
    const dashboard = document.querySelector('.dashboard');
    if (!document.fullscreenElement) {
        dashboard.requestFullscreen();
        document.querySelector('#toggleFullscreen i').className = 'fas fa-compress';
    } else {
        document.exitFullscreen();
        document.querySelector('#toggleFullscreen i').className = 'fas fa-expand';
    }
}

// Event listeners
document.getElementById('resetZoom').addEventListener('click', resetZoom);
document.getElementById('toggleFullscreen').addEventListener('click', toggleFullscreen);

// Yenile butonu için event listener ekleyelim
document.getElementById('refreshButton').addEventListener('click', async function() {
    const button = this;
    button.classList.add('loading');
    button.disabled = true;
    
    try {
        await updateAll();
        console.log('Data refreshed successfully');
    } catch (error) {
        console.error('Refresh error:', error);
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
});

// updateAll fonksiyonunu güncelleyelim
async function updateAll() {
    loadingDiv.style("display", "block");
    
    try {
        const button = document.getElementById('refreshButton');
        if (button) {
            button.classList.add('loading');
            button.disabled = true;
        }
        
        await Promise.all([
            updateVisualization(),
            fetchXU100Data()
        ]);
        
        loadingDiv.style("display", "none");
        console.log(`Data update completed for range: ${currentRange}`);
    } catch (error) {
        console.error('Update error:', error);
        loadingDiv.text("Veri güncellenirken hata oluştu");
    } finally {
        const button = document.getElementById('refreshButton');
        if (button) {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }
}

// Sayfa yüklendiğinde sadece bir kez çalıştır
document.addEventListener('DOMContentLoaded', function() {
    updateAll();
});