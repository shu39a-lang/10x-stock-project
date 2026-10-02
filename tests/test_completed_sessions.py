import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import unittest
from unittest.mock import patch
from datetime import datetime, timezone
import tempfile
import json
import numpy as np
import pandas as pd
import update_data as engine
import trend_diversity as trend


def utc(s):
    return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)


def candles(last='2026-10-01'):
    dates=pd.bdate_range(end=last,periods=260)
    close=100+np.arange(260)*0.1+np.sin(np.arange(260))*0.8
    frame=pd.DataFrame({'Close':close,'Volume':10000.0},index=dates)
    frame.iloc[-1,frame.columns.get_loc('Volume')]=50
    return frame


class Sessions(unittest.TestCase):
    def test_us_open_candle_reproduces_short_rejection(self):
        d=candles()
        # 23:16 JST is 10:16 New York: current-day volume is incomplete.
        now=utc('2026-10-01T14:16:00')
        row=engine.analyze_frame('AAPL','Apple',d,now)
        self.assertEqual(row['reference_date'],'2026-09-30')
        self.assertGreater(row['vol_ratio'],0.99)
        self.assertTrue(engine.horizon_ok(row,'short'))

    def test_japan_7am_uses_previous_close(self):
        d=candles('2026-10-02')
        row=engine.analyze_frame('6857.T','JP',d,utc('2026-10-01T22:00:00'))
        self.assertEqual(row['reference_date'],'2026-10-01')
        self.assertTrue(engine.horizon_ok(row,'short'))

    def test_us_7am_summer_uses_latest_close(self):
        d=candles()
        row=engine.analyze_frame('AAPL','US',d,utc('2026-10-01T22:00:00'))
        self.assertEqual(row['reference_date'],'2026-10-01')
        self.assertEqual(row['volume'],50)
        # Small real end-of-day volume must still fail the real criteria.
        self.assertFalse(engine.horizon_ok(row,'short'))

    def test_us_winter_close_buffer(self):
        d=candles('2026-12-01')
        before=engine.completed_daily_bars(d,'AAPL',utc('2026-12-01T21:30:00'))
        after=engine.completed_daily_bars(d,'AAPL',utc('2026-12-01T22:15:00'))
        self.assertEqual(str(before.index[-1].date()),'2026-11-30')
        self.assertEqual(str(after.index[-1].date()),'2026-12-01')

    def test_japan_intraday_excluded_until_close_buffer(self):
        d=candles()
        before=engine.completed_daily_bars(d,'6857.T',utc('2026-10-01T06:40:00'))
        after=engine.completed_daily_bars(d,'6857.T',utc('2026-10-01T07:30:00'))
        self.assertEqual(str(before.index[-1].date()),'2026-09-30')
        self.assertEqual(str(after.index[-1].date()),'2026-10-01')

    def test_weekend_and_holiday_do_not_invent_sessions(self):
        d=candles('2026-10-02')
        for symbol in ('AAPL','6857.T'):
            out=engine.completed_daily_bars(d,symbol,utc('2026-10-03T22:00:00'))
            self.assertEqual(str(out.index[-1].date()),'2026-10-02')
        holiday=d.iloc[:-1]
        out=engine.completed_daily_bars(holiday,'AAPL',utc('2026-10-02T22:00:00'))
        self.assertEqual(str(out.index[-1].date()),'2026-10-01')

    def test_timezone_aware_daily_session_labels(self):
        d=candles(); d.index=d.index.tz_localize('America/New_York')
        out=engine.completed_daily_bars(d,'AAPL',utc('2026-10-01T14:16:00'))
        self.assertEqual(str(out.index[-1].date()),'2026-09-30')

    def test_acquisition_failure_preserves_published_data(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'tenx_data.json';p.write_text('previous-good-data')
            with patch.object(engine,'R',Path(tmp)), patch.object(engine,'screen_universe',return_value=({'AAPL':'Apple'},'test')),patch.object(engine,'download_market',return_value=[]):
                with self.assertRaises(RuntimeError):engine.main()
            self.assertEqual(p.read_text(),'previous-good-data')

    def test_jp_trend_reuses_same_session_without_download(self):
        row=engine.analyze_frame('6857.T','JP',candles(),utc('2026-10-01T14:16:00'))
        row.update(valuation=60,quality=60,financial=60,catalyst=60)
        data={'japan':{'all':[row]},'usa':{'short':[]},'universe_stats':{'japan':{'reference_date':row['reference_date']}}}
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'data.json';p.write_text(json.dumps(data))
            with patch.object(trend,'DATA',p),patch.object(trend,'load_jpx_sector_map',return_value={}),patch.object(trend,'download_prices',side_effect=AssertionError('must not fetch twice')):
                trend.main()
            output=json.loads(p.read_text())
            self.assertEqual(output['japan']['short'][0]['code'],'6857')
            self.assertEqual(output['usa'],data['usa'])

    def test_true_zero_candidates_are_valid(self):
        row=engine.analyze_frame('AAPL','US',candles(),utc('2026-10-01T22:00:00'))
        for h in ('short','medium','long'):
            self.assertIsInstance(engine.horizon_ok(row,h),bool)
        self.assertFalse(engine.horizon_ok(row,'short'))

if __name__=='__main__':unittest.main()
