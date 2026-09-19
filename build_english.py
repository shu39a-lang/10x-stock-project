from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "main_source"

FILES = ["index.html","dynamic_rank.js","quick_buy_check.js","auto_score.js","stock_lookup_fix.js"]
for name in FILES:
    src = SRC / name
    if not src.exists():
        raise SystemExit(f"Missing source: {src}")
    shutil.copy2(src, ROOT / name)

def rep(s, pairs):
    for a,b in pairs:
        s=s.replace(a,b)
    return s

# index.html
p=ROOT/"index.html"
s=p.read_text(encoding="utf-8")
s=s.replace('<html lang="ja">','<html lang="en">',1)
s=s.replace('"https://shu39a-lang.github.io/10x-stock-project/"','"https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/english-version/"')
s=s.replace("https://jp.tradingview.com/","https://www.tradingview.com/")

pairs=[
('<div class="drawerGroupTitle">すぐ使う</div>','<div class="drawerGroupTitle">Quick Access</div>'),
('⌂ ホーム','⌂ Home'),('📊 買いタイミング診断','📊 Buy Timing Check'),('▥ 銘柄分析','▥ Stock Analysis'),
('🏆 TOP10ランキング','🏆 TOP10 Ranking'),('🔗 データ・ランキング','🔗 Data & Rankings'),
('<div class="drawerGroupTitle">保存・管理</div>','<div class="drawerGroupTitle">Save & Manage</div>'),
('▣ 保有株','▣ Holdings'),('☆ お気に入り','☆ Favorites'),('↶ 分析履歴','↶ Analysis History'),('⚙ 設定・その他','⚙ Settings'),
('<div class="drawerGroupTitle">ヘルプ</div>','<div class="drawerGroupTitle">Help</div>'),('？ 使い方ガイド','? User Guide'),
('>使い方ガイド<','>User Guide<'),('>株式分析ツール<','>Stock Analysis Tool<'),
('<span class="flag">🇯🇵</span>日本株','<span class="flag">🇯🇵</span>Japan Stocks'),
('<span class="flag">🇺🇸</span>米国株','<span class="flag">🇺🇸</span>U.S. Stocks'),
('data-term="short">短期<small>〜6か月</small>','data-term="short">Short Term<small>Up to 6 months</small>'),
('data-term="mid">中期<small>6か月〜1年</small>','data-term="mid">Mid Term<small>6–12 months</small>'),
('data-term="long">長期<small>1年以上</small>','data-term="long">Long Term<small>1+ year</small>'),
('◎ 選択中：<b id="statusText">日本株 / 短期</b>','◎ Selected: <b id="statusText">Japan Stocks / Short Term</b>'),
('<strong>銘柄を確認・入力して分析</strong><small>新規銘柄・保有株を5項目で分析</small>','<strong>Check or Enter a Stock to Analyze</strong><small>Analyze new stocks and holdings across 5 factors</small>'),
('🏆 日本株・短期 TOP10','🏆 Japan Stocks · Short Term TOP10'),('>全て見る 〉<','>View All 〉<'),
('🟥 赤：上昇期待　　🟦 青：安定上昇　　🟨 黄：成長株','🟥 Red: Upside Potential　　🟦 Blue: Stable Rise　　🟨 Yellow: Growth'),
('🕒 TOP10 データ更新時間（日本時間）','🕒 TOP10 Data Update Times (JST)'),
('06:30頃','Around 06:30'),('（アメリカ株）','(U.S. Stocks)'),('16:00頃','Around 16:00'),('（日本株）','(Japan Stocks)'),
('📊 データ・ランキング','📊 Data & Rankings'),('値上がり<br>ランキング','Top<br>Gainers'),('値下がり<br>ランキング','Top<br>Losers'),
('出来高<br>ランキング','Volume<br>Ranking'),('出来高<br>急増','Volume<br>Surge'),
('🇯🇵 日本株','🇯🇵 Japan'),('🇺🇸 米国株','🇺🇸 U.S.'),('🔥 注目・急増・高値','🔥 Movers, Surges & Highs'),
('決算カレンダー','Earnings Calendar'),('52週高値','52-Week Highs'),('セクター動向','Sector Trends'),('スクリーナー','Screener'),
('📋 分析・検索','📋 Analysis & Search'),
('個別銘柄検索<br><small>銘柄コード・銘柄名で検索</small>','Stock Search<br><small>Search by ticker or company name</small>'),
('<b>↶</b>分析履歴<br>過去の分析結果','<b>↶</b>Analysis History<br>Past analysis results'),
('⚙️ 管理・設定','⚙️ Manage & Settings'),('<b>☆</b>お気に入り<br>登録銘柄一覧','<b>☆</b>Favorites<br>Saved stocks'),
('<b>▣</b>保有株管理<br>保有銘柄の管理','<b>▣</b>Holdings<br>Manage holdings'),('<b>⚙</b>設定<br>各種設定','<b>⚙</b>Settings<br>App settings'),
('📈 銘柄を確認・入力して分析','📈 Check or Enter a Stock to Analyze'),
('外部サイトで情報を確認し、5項目を0〜100で評価すると自動で総合スコアを計算します。','Review the information and score five factors from 0–100 to calculate the overall score automatically.'),
('>日本株</option>','>Japan Stocks</option>'),('>米国株</option>','>U.S. Stocks</option>'),
('<span style="font-size:17px">🇯🇵</span> 日本株','<span style="font-size:17px">🇯🇵</span> Japan Stocks'),
('<span style="font-size:17px">🇺🇸</span> 米国株','<span style="font-size:17px">🇺🇸</span> U.S. Stocks'),
('>銘柄コード<input','>Ticker / Code<input'),('>会社名<input id="nameInput" placeholder="会社名"','>Company Name<input id="nameInput" placeholder="Company name"'),
('コードを入力すると会社名と現在値を確認します。','Enter a ticker/code to look up the company name and current price.'),
('>株数<input','>Shares<input'),('>購入単価<input','>Purchase Price<input'),('>現在値<input','>Current Price<input'),('>メモ<input','>Notes<input'),
('placeholder="任意"','placeholder="Optional"'),('↗ 株価・会社情報を確認','↗ Check Price & Company Info'),('入力をクリア','Clear Input'),
('割安性（20点）','Valuation (20%)'),('品質・成長（25点）','Quality & Growth (25%)'),('財務（15点）','Financial Strength (15%)'),
('テクニカル（25点）','Technical (25%)'),('カタリスト（15点）','Catalyst (15%)'),
('>総合スコア<','>Overall Score<'),('>格付 C<','>Grade C<'),('分析結果を保存','Save Analysis'),('保有株として保存','Save as Holding'),
('お気に入りに保存','Save to Favorites'),('ホームへ戻る','Back to Home'),
('💼 保有株管理','💼 Holdings'),('この端末に保存した保有銘柄です。損益は入力した現在値で計算します。','Holdings saved on this device. Profit/loss is calculated using the current price entered.'),
('☆ お気に入り','☆ Favorites'),('ランキングや保有株から登録した銘柄です。','Stocks saved from rankings or holdings.'),
('↶ 分析履歴','↶ Analysis History'),('保存した分析結果を新しい順に表示します。','Saved analysis results are shown newest first.'),
('⚙️ 設定・その他','⚙️ Settings'),('10X STOCK ZERO 最終完成版 v1.0','10X STOCK ZERO Final Release v1.0'),
('データを書き出す','Export Data'),('データを読み込む','Import Data'),('分析履歴を消去','Clear Analysis History'),('全保存データを消去','Delete All Saved Data'),
('📊 10X STOCK ZEROの分析について','📊 About 10X STOCK ZERO Analysis'),('📄 法務・サポート','📄 Legal & Support'),
('プライバシーポリシー','Privacy Policy'),('利用規約・免責事項','Terms of Use & Disclaimer'),('お問い合わせ・サポート','Contact & Support'),
('<b>⌂</b>ホーム','<b>⌂</b>Home'),('<b>▥</b>分析結果','<b>▥</b>Analysis'),('<b>▣</b>保有株','<b>▣</b>Holdings'),
('<b>☆</b>お気に入り','<b>☆</b>Favorites'),('<b>⚙</b>設定・その他','<b>⚙</b>Settings'),
('<div class="modalhead"><h3>使い方ガイド</h3>','<div class="modalhead"><h3>User Guide</h3>'),
('<b>1. 市場と期間を選ぶ</b><br>','<b>1. Choose a Market and Time Horizon</b><br>'),
('<b>2. TOP10ランキングを見る</b><br>','<b>2. View the TOP10 Ranking</b><br>'),
('<b>3. TOP10の更新時間</b><br>','<b>3. TOP10 Update Times</b><br>'),
('<b>4. 買いタイミング診断</b><br>','<b>4. Buy Timing Check</b><br>'),
('<b>5. 銘柄を詳しく分析する</b><br>','<b>5. Analyze a Stock in Detail</b><br>'),
('<b>6. 分析結果を保存する</b><br>','<b>6. Save Analysis Results</b><br>'),
('<b>7. データ・ランキングのリンク</b><br>','<b>7. Data & Ranking Links</b><br>'),
('<b>8. 注目・急増・高値のリンク</b><br>','<b>8. Movers, Surges & Highs</b><br>'),
('<b>9. お気に入りと保有株管理</b><br>','<b>9. Favorites and Holdings</b><br>'),
('<b>10. 設定・バックアップ</b><br>','<b>10. Settings & Backup</b><br>'),
('<b>重要な注意事項</b><br>','<b>Important Notice</b><br>'),
('ホーム画面で「日本株」または「米国株」を選び、投資期間を選択します。','On the Home screen, choose Japan Stocks or U.S. Stocks, then select an investment horizon.'),
('・短期：6か月以内','• Short Term: up to 6 months'),('・中期：6か月〜1年','• Mid Term: 6–12 months'),('・長期：1年以上','• Long Term: 1 year or more'),
('選択した市場と期間に合わせて、TOP10ランキングが切り替わります。','The TOP10 ranking updates to match your selected market and time horizon.'),
('TOP10には、銘柄コード・銘柄名・総合スコア・格付が表示されます。「11〜20位を見る」を押すと20位まで表示でき、「TOP10に戻る」を押すと元に戻ります。','TOP10 shows ticker/code, company name, overall score, and grade. Tap “View 11–20” to see ranks 11–20, and “Back to TOP10” to return.'),
('順位左側の色は、銘柄の特徴を示しています。','The color beside each rank indicates the stock profile.'),
('・赤：上昇期待','• Red: Upside Potential'),('・青：安定上昇','• Blue: Stable Rise'),('・黄：成長株','• Yellow: Growth'),
('この色分けは銘柄の特徴を表すもので、売買を直接指示するものではありません。星印を押すと「お気に入り」に登録できます。銘柄コードまたは銘柄名を押すと、外部サイトで詳しい株価情報を確認できます。','These colors describe stock characteristics and are not direct trading instructions. Tap the star to save a stock to Favorites. Tap the ticker/code or company name to view detailed market information on an external site.'),
('ランキングデータは、原則として日本時間の次の時刻に更新されます。','Ranking data is generally updated at the following Japan Standard Time (JST) times.'),
('・米国株：午前6時30分頃','• U.S. Stocks: around 6:30 AM'),('・日本株：午後4時頃','• Japan Stocks: around 4:00 PM'),
('市場休場日やデータ提供状況によっては、前取引日のデータが表示される場合や、更新が遅れる場合があります。','On market holidays or when data is delayed, the previous trading day’s data may be shown or updates may arrive later.'),
('気になる銘柄が、現在どのような買い条件にあるかを確認できます。日本株は4桁の銘柄コード、米国株はティッカーシンボルを入力し、「診断する」を押します。入力例：7203／AAPL','Enter a 4-digit code for Japan stocks or a ticker symbol for U.S. stocks, then tap “Check.” Example: 7203 / AAPL.'),
('診断結果には、現在値、総合判断、総合・テクニカル・トレンドの3つのゲージ、判断の理由、各分析項目の点数が表示されます。結果は「強い買い」「買い」「慎重」「様子見」の4段階です。','Results show current price, overall view, Overall/Technical/Trend gauges, reasons, and factor scores. The four levels are Strong Buy, Buy, Caution, and Wait.'),
('「強い買い」や「買い」は、総合スコアだけではなく、テクニカル、トレンド、企業の品質・成長性、財務、成長材料などを組み合わせて判定します。現在の分析対象データに含まれていない銘柄は、診断できない場合があります。','Strong Buy and Buy use a combination of overall score, technicals, trend, quality/growth, financial strength, and catalysts. Stocks outside the current analysis dataset may not be available for this check.'),
('「銘柄を確認・入力して分析」または「個別銘柄検索」を押すと、銘柄分析画面が開きます。日本株または米国株を選び、銘柄コードを入力してください。取得可能な場合は、会社名・現在値・分析点数が自動的に反映されます。株数、購入単価、現在値、メモは必要に応じて入力します。','Tap “Check or Enter a Stock to Analyze” or “Stock Search.” Select Japan Stocks or U.S. Stocks and enter a ticker/code. When available, the company name, current price, and analysis scores are filled automatically. Enter shares, purchase price, current price, and notes as needed.'),
('主な分析項目と配点は次のとおりです。','The five main analysis factors are:'),
('・割安性：20点','• Valuation: 20%'),('・品質・成長：25点','• Quality & Growth: 25%'),('・財務：15点','• Financial Strength: 15%'),
('・テクニカル：25点','• Technical: 25%'),('・カタリスト：15点','• Catalyst: 15%'),
('合計100点で総合スコアと格付を表示します。自動取得できない項目は手入力または調整できます。','The overall score and grade are based on a 100-point scale. Values that cannot be retrieved automatically can be entered or adjusted manually.'),
('・分析結果を保存：分析履歴へ保存します。','• Save Analysis: saves to Analysis History.'),
('・保有株として保存：株数、購入単価、現在値などを保有株へ保存します。','• Save as Holding: saves shares, purchase price, current price, and related data to Holdings.'),
('・お気に入りに保存：あとで確認したい銘柄として保存します。','• Save to Favorites: saves a stock for later review.'),
('分析履歴では、過去の分析結果を新しい順に確認し、再び開いて編集できます。','Analysis History lets you review saved results from newest to oldest and reopen them for editing.'),
('<b>値上がりランキング</b><br>','<b>Top Gainers</b><br>'),('<b>値下がりランキング</b><br>','<b>Top Losers</b><br>'),
('<b>出来高ランキング</b><br>','<b>Volume Ranking</b><br>'),('<b>出来高急増</b><br>','<b>Volume Surge</b><br>'),
('<b>決算カレンダー</b><br>','<b>Earnings Calendar</b><br>'),('<b>52週高値</b><br>','<b>52-Week Highs</b><br>'),
('<b>セクター動向</b><br>','<b>Sector Trends</b><br>'),('<b>スクリーナー</b><br>','<b>Screener</b><br>'),
('<b>お気に入り</b><br>','<b>Favorites</b><br>'),('<b>保有株管理</b><br>','<b>Holdings</b><br>')
]
s=rep(s,pairs)

company_map={"アドバンテスト":"Advantest","東京エレクトロン":"Tokyo Electron","三菱重工業":"Mitsubishi Heavy Industries","フジクラ":"Fujikura","ソフトバンクG":"SoftBank Group","日立製作所":"Hitachi","トヨタ自動車":"Toyota Motor","三菱UFJ FG":"Mitsubishi UFJ Financial Group","信越化学工業":"Shin-Etsu Chemical","ダイキン工業":"Daikin Industries","三菱商事":"Mitsubishi Corporation","東京海上HD":"Tokio Marine Holdings"}
for a,b in company_map.items():
    s=s.replace('"'+a+'"','"'+b+'"')

js_pairs=[
('const arr=DATA[state.market][state.term], ml=state.market==="japan"?"日本株":"米国株", tl={short:"短期",mid:"中期",long:"長期"}[state.term];','const arr=DATA[state.market][state.term], ml=state.market==="japan"?"Japan Stocks":"U.S. Stocks", tl={short:"Short Term",mid:"Mid Term",long:"Long Term"}[state.term];'),
('$("#rankingTitle").textContent="🏆 "+ml+"・"+tl+" TOP10";','$("#rankingTitle").textContent="🏆 "+ml+" · "+tl+" TOP10";'),
('$("#allBtn").textContent=state.showAll?"TOP10に戻る":"11〜20位を見る";','$("#allBtn").textContent=state.showAll?"Back to TOP10":"View 11–20";'),
('<div>順位</div><div>コード</div><div>銘柄名</div><div>スコア</div><div>格付</div><div>☆</div>','<div>Rank</div><div>Code</div><div>Company</div><div>Score</div><div>Grade</div><div>☆</div>'),
('$("#totalScore").textContent=total;$("#totalGrade").textContent="格付 "+grade(total);','$("#totalScore").textContent=total;$("#totalGrade").textContent="Grade "+grade(total);'),
('alert("銘柄コードと会社名を入力してください")','alert("Enter a ticker/code and company name.")'),
('st.textContent="会社名・現在値を検索中…"','st.textContent="Looking up company name and current price…"'),
('"✓ "+name+" ｜ 現在値 "','"✓ "+name+" | Current Price "'),
('"✓ "+name+" を確認しました。現在値は取得できませんでした。"','"✓ "+name+" found. Current price is unavailable."'),
('"自動取得できませんでした。会社名と現在値を手入力できます。"','"Automatic lookup failed. You can enter the company name and current price manually."'),
('alert("先に銘柄コードを入力してください")','alert("Enter a ticker/code first.")'),
('alert("分析結果を保存しました")','alert("Analysis saved.")'),('alert("お気に入りに保存しました")','alert("Saved to Favorites.")'),
('alert("保有株として保存しました")','alert("Saved as a holding.")'),('まだ保有株の登録はありません。','No holdings have been added yet.'),
('現在値を更新','Update Current Price'),('現在値を反映','Update Price'),('情報確認','View Info'),('分析を編集','Edit Analysis'),
('別分析として開く','Open as New Analysis'),('現在値を正しく入力してください','Enter a valid current price.'),
('この保有株を削除しますか？','Delete this holding?'),('お気に入りに追加しました','Added to Favorites.'),
('お気に入りはまだありません。','No favorites yet.'),('分析履歴はまだありません。','No analysis history yet.'),
('toLocaleString("ja-JP")','toLocaleString("en-US")'),('v.market==="japan"?"日本株":"米国株"','v.market==="japan"?"Japan Stocks":"U.S. Stocks"'),
('v.memo||"メモなし"','v.memo||"No notes"'),('この分析を開く','Open Analysis'),
('分析履歴をすべて消去しますか？','Clear all analysis history?'),('消去しました','Cleared.'),
('保有株・お気に入り・分析履歴をすべて消去しますか？','Delete all holdings, favorites, and analysis history?'),
('すべて消去しました','All saved data deleted.'),('title:"10X STOCK ZERO バックアップ"','title:"10X STOCK ZERO Backup"'),
('alert("データを読み込みました")','alert("Data imported.")'),('alert("10X STOCK ZEROのバックアップファイルを読み込めませんでした")','alert("Could not import the 10X STOCK ZERO backup file.")')
]
s=rep(s,js_pairs)

url_pairs=[
("https://finance.yahoo.co.jp/stocks/ranking/up?market=all","https://www.tradingview.com/markets/stocks-japan/market-movers-gainers/"),
("https://finance.yahoo.co.jp/stocks/us/ranking/up","https://www.tradingview.com/markets/stocks-usa/market-movers-gainers/"),
("https://finance.yahoo.co.jp/stocks/ranking/down?market=all","https://www.tradingview.com/markets/stocks-japan/market-movers-losers/"),
("https://finance.yahoo.co.jp/stocks/us/ranking/down","https://www.tradingview.com/markets/stocks-usa/market-movers-losers/"),
("https://finance.yahoo.co.jp/stocks/ranking/volume?market=all&term=daily","https://www.tradingview.com/markets/stocks-japan/market-movers-active/"),
("https://finance.yahoo.co.jp/stocks/us/ranking/volume","https://www.tradingview.com/markets/stocks-usa/market-movers-active/")
]
s=rep(s,url_pairs)
old='function stockUrl(m,c){return m==="japan"?"https://finance.yahoo.co.jp/quote/"+encodeURIComponent(c)+".T":"https://finance.yahoo.co.jp/quote/"+encodeURIComponent(c)}'
new='function stockUrl(m,c){return m==="japan"?"https://www.tradingview.com/symbols/TSE-"+encodeURIComponent(c)+"/":"https://www.tradingview.com/symbols/"+encodeURIComponent(c)+"/"}'
if old in s:s=s.replace(old,new,1)
p.write_text(s,encoding="utf-8")

# dynamic_rank.js
p=ROOT/"dynamic_rank.js";s=p.read_text(encoding="utf-8")
s=s.replace('"https://shu39a-lang.github.io/10x-stock-project/tenx_data.json"','"https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/english-version/tenx_data.json"')
s=s.replace('String(item.x.name || ""),','String(item.x.name_en || item.x.name || ""),')
p.write_text(s,encoding="utf-8")

# quick_buy_check.js
p=ROOT/"quick_buy_check.js";s=p.read_text(encoding="utf-8")
s=s.replace("https://shu39a-lang.github.io/10x-stock-project/tenx_data.json","https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/english-version/tenx_data.json")
s=rep(s,[(' 買いタイミング診断',' Buy Timing Check'),('データ・ランキング','Data & Rankings'),('注目・急増・高値','Movers, Surges & Highs'),('分析・検索','Analysis & Search'),('値上がり','Top Gainers'),('値下がり','Top Losers'),('出来高 ランキング','Volume Ranking'),('出来高 急増','Volume Surge'),('決算カレンダー','Earnings Calendar'),('52週高値','52-Week Highs'),('セクター動向','Sector Trends'),('スクリーナー','Screener'),('TOP10 データ更新時間（日本時間）','TOP10 Data Update Times (JST)'),('TOP10 データ更新時間','TOP10 Data Update Times'),('気になる銘柄コードを入力して、現在の買い条件を確認','Enter a ticker/code to check the current buy conditions'),('>診断する<','>Check<'),('現在の分析データを使って判定します。','Uses the current analysis data.'),('let text="様子見",cls="watch";','let text="Wait",cls="watch";'),('text="強い買い";cls="strong"','text="Strong Buy";cls="strong"'),('text="買い";cls="buy"','text="Buy";cls="buy"'),('text="慎重";cls="care"','text="Caution";cls="care"'),('return{text:"強い買い",color:"#ff3d5e"}','return{text:"Strong Buy",color:"#ff3d5e"}'),('return{text:"買い",color:"#49dc80"}','return{text:"Buy",color:"#49dc80"}'),('return{text:"慎重",color:"#ffc73d"}','return{text:"Caution",color:"#ffc73d"}'),('return{text:"様子見",color:"#288cff"}','return{text:"Wait",color:"#288cff"}'),('<span>様子見</span><span>慎重</span><span>買い</span><span>強い買い</span>','<span>Wait</span><span>Caution</span><span>Buy</span><span>Strong Buy</span>'),('総合スコアが高い水準です。','The overall score is high.'),('総合スコアは買いを検討できる水準です。','The overall score is at a level worth considering.'),('総合スコアは慎重に確認したい水準です。','The overall score calls for caution.'),('総合スコアは様子を見たい水準です。','The overall score suggests waiting.'),('テクニカル面の勢いは良好です。','Technical momentum is strong.'),('テクニカル面はまだ弱めです。','Technical momentum is still weak.'),('企業の質・成長性も高く評価されています。','Quality and growth are rated highly.'),('財務評価には確認余地があります。','Financial strength needs further review.'),('found.market==="japan"?"日本株":"米国株"','found.market==="japan"?"Japan Stocks":"U.S. Stocks"'),('found.market==="japan"?"円":"USD"','found.market==="japan"?"JPY":"USD"'),('<small>総合判断</small>','<small>Overall View</small>'),('gaugeHTML("総合",j.total)','gaugeHTML("Overall",j.total)'),('gaugeHTML("テクニカル",j.technical)','gaugeHTML("Technical",j.technical)'),('gaugeHTML("トレンド",j.trend)','gaugeHTML("Trend",j.trend)'),('<b>判断の理由</b>','<b>Reasons</b>'),('<span>総合スコア</span>','<span>Overall Score</span>'),('<span>テクニカル</span>','<span>Technical</span>'),('<span>品質・成長</span>','<span>Quality & Growth</span>'),('<span>財務</span>','<span>Financial</span>'),('<span>割安性</span>','<span>Valuation</span>'),('<span>カタリスト</span>','<span>Catalyst</span>'),('※この診断は現在の分析データによる判断目安です。将来の株価上昇や利益を保証するものではありません。','This check is a reference based on current analysis data and does not guarantee future price gains or profits.'),('銘柄コードを入力してください。','Enter a ticker/code.'),('分析しています…','Analyzing…'),('現在の分析対象データでは見つかりませんでした。','Not found in the current analysis dataset.'),('診断結果を表示しました。','Results displayed.'),('分析データを読み込めませんでした。','Could not load analysis data.')])
s=s.replace('${x.code||""}　${x.name||""}','${x.code||""}　${x.name_en||x.name||""}')
p.write_text(s,encoding="utf-8")

# auto_score.js
p=ROOT/"auto_score.js";s=p.read_text(encoding="utf-8")
s=s.replace("https://shu39a-lang.github.io/10x-stock-project/tenx_data.json","https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/english-version/tenx_data.json")
s=s.replace("https://shu39a-lang.github.io/10x-stock-project/live_quotes.json","https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/english-version/live_quotes.json")
s=s.replace("https://jp.tradingview.com/","https://www.tradingview.com/")
s=rep(s,[('"バックアップを保存"','"Save Backup"'),('"バックアップから復元"','"Restore Backup"'),('"<b>🇯🇵</b>日本株スクリーナー<br>日本語で銘柄を絞り込み"','"<b>🇯🇵</b>Japan Stock Screener<br>Filter Japan stocks"'),('"米国株スクリーナー"','"U.S. Stock Screener"'),('"日本株スクリーナー"','"Japan Stock Screener"'),('"市場データの自動取得は行いません"','"Market data is not retrieved automatically"'),('"保有株の現在値は取得可能な市場データから更新します。取得できない場合は手入力できます。特定銘柄の売買を推奨するものではありません。"','"Holding prices are updated from available market data. If unavailable, you can enter the price manually. This app does not recommend buying or selling any specific stock."'),('"現在値を反映"','"Update Price"'),('"現在値を取得中…"','"Updating price…"'),('"最新株価を取得できませんでした。通信状態を確認してもう一度押すか、現在値を手入力してください。"','"Could not retrieve the latest price. Check your connection and try again, or enter the current price manually."'),('"10X STOCK ZERO バックアップ"','"10X STOCK ZERO Backup"'),('"バックアップを保存できませんでした。もう一度お試しください。"','"Could not save the backup. Please try again."')])
p.write_text(s,encoding="utf-8")

# stock_lookup_fix.js
p=ROOT/"stock_lookup_fix.js";s=p.read_text(encoding="utf-8")
s=s.replace('const ROOT="https://shu39a-lang.github.io/10x-stock-project/";','const ROOT="https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/english-version/";')
s=s.replace('name:String(q.name||"").trim(),','name:String(q.name_en||q.name||"").trim(),')
s=s.replace('const tenxName=String(tenx?.name||"").trim();','const tenxName=String(tenx?.name_en||tenx?.name||"").trim();')
s=rep(s,[('st.textContent="✓ "+name+" ｜ 現在値 "+','st.textContent="✓ "+name+" | Current Price "+'),('st.textContent="✓ "+name+" を確認しました。現在値は取得できませんでした。";','st.textContent="✓ "+name+" found. Current price is unavailable.";'),('st.textContent="自動取得できませんでした。会社名と現在値を手入力できます。";','st.textContent="Automatic lookup failed. You can enter the company name and current price manually.";'),('st.textContent="コードを入力すると会社名と現在値を確認します。";','st.textContent="Enter a ticker/code to look up the company name and current price.";'),('st.textContent="会社名・現在値を検索中…";','st.textContent="Looking up company name and current price…";')])
s=re.sub(r'  if\(market==="japan"\)\{.*?\n  \}\n\n  const source=', '  // English build: use English display name first; price-source priority is unchanged.\n  name=tenxName||liveName||baseName||directName||code;\n\n  const source=', s, count=1, flags=re.S)
p.write_text(s,encoding="utf-8")

# Basic visible-HTML audit.
idx=(ROOT/"index.html").read_text(encoding="utf-8")
v=re.sub(r'<!--.*?-->','',idx,flags=re.S)
v=re.sub(r'<script\b.*?</script>','',v,flags=re.S|re.I)
v=re.sub(r'<style\b.*?</style>','',v,flags=re.S|re.I)
v=re.sub(r'<[^>]+>',' ',v)
left=sorted(set(re.findall(r'[\u3040-\u30ff\u3400-\u9fff]+',v)))
if left:
    raise SystemExit("Visible Japanese remains: "+"/".join(left[:50]))
for marker in ("function renderRanking","calcScore();renderRanking();"):
    if marker not in idx: raise SystemExit("Core logic marker missing: "+marker)
print("English source build completed.")
