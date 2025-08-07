import streamlit as st
import pandas as pd
import plotly.express as px
from clickhouse_connect import get_client
from st_aggrid import AgGrid
import time

try:
    from streamlit import script_runner, script_request_queue
except ImportError:
    script_runner = None
    script_request_queue = None

st.set_page_config(page_title="Binance Order Book Dashboard", layout="wide")
REFRESH_INTERVAL = 5  # seconds

client = get_client(
    host="localhost",
    port=8123,
    username="default",
    password="mysecret",
    database="default"
)

@st.cache_data(ttl=REFRESH_INTERVAL)
def get_data():
    query = """
        SELECT * FROM binance_btcusdt_orderbook
        WHERE timestamp > now('Europe/London') - INTERVAL 10 MINUTE
    """
    return client.query_df(query)

st.title("📊 Real-Time Binance Order Book Dashboard")
st.caption(f"Auto-refreshes every {REFRESH_INTERVAL} seconds")

data = get_data()

st.subheader("Raw data preview (first 100 rows)")
AgGrid(
    data.head(100),
    fit_columns_on_grid_load=True,
    enable_enterprise_modules=False,
    key="aggrid"
)

spread_placeholder = st.empty()
heatmap_placeholder = st.empty()

def draw_plots(data):
    data['timestamp'] = pd.to_datetime(data['timestamp']).dt.tz_convert(None)

    spread_df = data.pivot_table(index='timestamp', columns='order_type', values='price', aggfunc='first')
    spread_df['spread'] = spread_df['Ask'] - spread_df['Bid']

    fig_spread = px.line(
        spread_df.reset_index(), x='timestamp', y='spread',
        title='Live Bid-Ask Spread Over Time'
    )

    volume_df = data.groupby(['order_level', 'order_type'])['volume'].mean().reset_index()
    volume_pivot = volume_df.pivot(index='order_level', columns='order_type', values='volume')
    fig_heatmap = px.imshow(
        volume_pivot,
        labels=dict(x="Order Type", y="Order Level", color="Avg Volume"),
        title="Average Volume by Level & Type"
    )

    spread_placeholder.plotly_chart(fig_spread, use_container_width=True)
    heatmap_placeholder.plotly_chart(fig_heatmap, use_container_width=True)

draw_plots(data)

if "count" not in st.session_state:
    st.session_state.count = 0
else:
    st.session_state.count += 1

time.sleep(REFRESH_INTERVAL)

if script_runner and script_request_queue:
    raise script_runner.RerunException(script_request_queue.RerunData())
else:
    st.warning("Auto-refresh not supported on this Streamlit version. Please refresh manually.")