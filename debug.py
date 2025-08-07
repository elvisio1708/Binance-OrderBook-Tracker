import streamlit as st
from clickhouse_connect import get_client

st.title("Debug ClickHouse Data Fetch")

client = get_client(
    host="localhost",
    port=8123,
    username="default",
    password="mysecret",
    database="default"
)

@st.cache_data(ttl=10)
def fetch_all():
    query = "SELECT * FROM binance_btcusdt_orderbook LIMIT 100"
    return client.query_df(query)

data = fetch_all()

st.write(f"Rows fetched: {len(data)}")
st.write("Columns:", list(data.columns))

st.subheader("Raw data preview (first 20 rows)")
st.table(data.head(20))
