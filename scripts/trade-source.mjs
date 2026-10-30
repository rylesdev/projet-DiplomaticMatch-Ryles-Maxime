export const TRADE_FROM = 2000;
export const TRADE_TO = 2024;
export const TRADE_SOURCE_URL = 'https://data.imf.org/Datasets/IMTS';
export const TRADE_LICENSE_URL = 'https://www.imf.org/en/About/copyright-and-terms';
export const TRADE_DOWNLOAD_URL =
  'https://api.imf.org/external/sdmx/2.1/data/IMF.STA,IMTS,1.0.0/.XG_FOB_USD..A' +
  `?startPeriod=${TRADE_FROM}&endPeriod=${TRADE_TO}`;
export const TRADE_RAW = new URL(
  '../data/raw/trade/imf-imts-exports-2000-2024.xml',
  import.meta.url,
);
export const TRADE_ACQUISITION = new URL('../data/raw/trade/acquisition.json', import.meta.url);
