//+------------------------------------------------------------------+
//|                                    XAUUSD_M5Range_M1Sweep.mq5    |
//|  M5 3-candle swing range -> fib 50% (M1 close) -> M1 sweep scalp |
//|                                                                  |
//|  Bull: middle M5 has lowest Low. Confirmed on 3rd close.         |
//|  Candle 4 must print above High of candle 3. Fib Low -> High.    |
//|  M1 close below 50% -> M1 BUY sweeps only.                       |
//|  Bear: mirror. M1 close above 50% -> M1 SELL sweeps only.        |
//|  New 3-bar M5 swing replaces the range.                          |
//+------------------------------------------------------------------+
#property copyright "ExnessfxBot"
#property version   "1.10"
#property description "M5 range fib 50% then M1 sweep scalps. Bull=buys, bear=sells. Static SL, TP 3R."
#property strict

#include <Trade\Trade.mqh>

enum ENUM_LOT_MODE
  {
   LOT_RISK_PERCENT = 0,
   LOT_FIXED        = 1,
   LOT_MONEY        = 2
  };

input group "=== Strategy ==="
input double            InpRewardR            = 3.0;
input bool              InpAllowBull          = true;
input bool              InpAllowBear          = true;
input bool              InpOnePositionOnly    = true;
input bool              InpOneTradePerM1      = true;
input double            InpMaxSeqR            = 2.0;    // Halt this range after this much sequential losing R
input int               InpSLBufferPoints     = 30;
input double            InpMinRiskPrice       = 0.30;
input double            InpMaxRiskPrice       = 15.0;

input group "=== Session ==="
input int               InpTradeFromHour      = 4;
input int               InpTradeToHour        = 20;
input bool              InpUseNewsFilter      = true;
input int               InpNewsPadHours       = 1;

input group "=== Risk ==="
input ENUM_LOT_MODE     InpLotMode            = LOT_MONEY;
input double            InpRiskPercent        = 1.0;
input double            InpRiskMoney          = 20000;
input double            InpMaxRiskPctEquity   = 2.0;
input double            InpFixedLot           = 0.01;
input bool              InpSkipIfMinLotOver   = true;
input int               InpMaxSpreadPoints    = 80;
input ulong             InpMagic              = 260919;
input int               InpDeviationPoints    = 30;
input string            InpComment            = "M5RngM1";

input group "=== Display ==="
input bool              InpDrawLevels         = true;
input bool              InpShowPanel          = true;

CTrade   g_trade;
int      g_digits = 2;
double   g_point  = 0.01;
int      g_stopsLevel = 0;
string   g_pfx = "M5R1_";

datetime g_rngTime = 0;
datetime g_scTime = 0;

enum ENUM_RANGE_STATE
  {
   ST_IDLE    = 0,
   ST_WAIT_C4 = 1,
   ST_TRACK   = 2,
   ST_ARMED   = 3
  };

ENUM_RANGE_STATE g_state = ST_IDLE;
int      g_dir = 0;          // +1 bull, -1 bear
double   g_swing = 0;        // bull low / bear high
double   g_c3ext = 0;        // bull: high of candle 3; bear: low of candle 3
double   g_fibEnd = 0;       // running opposite extreme
bool     g_c4ok = false;
bool     g_didM1 = false;
bool     g_rangeHalt = false;
double   g_seqLossR = 0;

string g_news[] =
  {
   "2026.01.09 13:30|USD NFP",
   "2026.01.13 13:30|USD CPI",
   "2026.01.14 13:30|USD PPI",
   "2026.01.28 19:00|USD FOMC",
   "2026.01.30 13:30|USD PCE",
   "2026.02.11 13:30|USD NFP+CPI",
   "2026.02.12 13:30|USD PPI",
   "2026.02.27 13:30|USD PCE",
   "2026.03.06 13:30|USD NFP",
   "2026.03.11 12:30|USD CPI",
   "2026.03.12 12:30|USD PPI",
   "2026.03.18 18:00|USD FOMC",
   "2026.03.27 12:30|USD PCE",
   "2026.04.03 12:30|USD NFP",
   "2026.04.10 12:30|USD CPI",
   "2026.04.14 12:30|USD PPI",
   "2026.04.29 18:00|USD FOMC",
   "2026.04.30 12:30|USD PCE",
   "2026.05.08 12:30|USD NFP",
   "2026.05.12 12:30|USD CPI",
   "2026.05.13 12:30|USD PPI",
   "2026.05.29 12:30|USD PCE",
   "2026.06.05 12:30|USD NFP",
   "2026.06.10 12:30|USD CPI",
   "2026.06.11 12:30|USD PPI",
   "2026.06.17 18:00|USD FOMC",
   "2026.06.26 12:30|USD PCE",
   "2026.07.02 12:30|USD NFP",
   "2026.07.14 12:30|USD CPI",
   "2026.07.15 12:30|USD PPI",
   "2026.07.29 18:00|USD FOMC",
   "2026.07.31 12:30|USD PCE",
   "2026.08.03 14:00|USD ISM Mfg",
   "2026.08.04 14:00|USD JOLTS",
   "2026.08.05 12:15|USD ADP",
   "2026.08.05 14:00|USD ISM Svc",
   "2026.08.07 12:30|USD NFP",
   "2026.08.12 12:30|USD CPI",
   "2026.08.19 18:00|USD FOMC minutes",
   "2026.08.26 12:30|USD PCE/GDP",
   "2026.08.28 14:00|USD Warsh JH",
   "2026.09.04 12:30|USD NFP"
  };

int OnInit()
  {
   g_digits     = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   g_point      = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   g_stopsLevel = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_STOPS_LEVEL);
   if(g_point <= 0)
      g_point = _Point;
   g_trade.SetExpertMagicNumber(InpMagic);
   g_trade.SetDeviationInPoints(InpDeviationPoints);
   g_trade.SetMarginMode();
   long filling = SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      g_trade.SetTypeFilling(ORDER_FILLING_IOC);
   else if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      g_trade.SetTypeFilling(ORDER_FILLING_FOK);
   else
      g_trade.SetTypeFilling(ORDER_FILLING_RETURN);
   g_rngTime = iTime(_Symbol, PERIOD_M5, 0);
   g_scTime  = iTime(_Symbol, PERIOD_M1, 0);
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, g_pfx);
   Comment("");
  }

void OnTick()
  {
   datetime rng = iTime(_Symbol, PERIOD_M5, 0);
   datetime sc  = iTime(_Symbol, PERIOD_M1, 0);
   if(rng == 0 || sc == 0)
      return;
   if(rng != g_rngTime)
     {
      OnRangeClosed();
      g_rngTime = rng;
     }
   if(sc != g_scTime)
     {
      OnScalpClosed();
      g_scTime = sc;
      g_didM1 = false;
     }
   UpdateFormingFib();
   TryM1Sweep();
   DrawLevels();
   UpdatePanel();
  }

void ResetRange()
  {
   g_state = ST_IDLE;
   g_dir = 0;
   g_swing = 0;
   g_c3ext = 0;
   g_fibEnd = 0;
   g_c4ok = false;
   g_rangeHalt = false;
   g_seqLossR = 0;
  }

void OnRangeClosed()
  {
   double l3 = iLow(_Symbol, PERIOD_M5, 3);
   double l2 = iLow(_Symbol, PERIOD_M5, 2);
   double l1 = iLow(_Symbol, PERIOD_M5, 1);
   double h3 = iHigh(_Symbol, PERIOD_M5, 3);
   double h2 = iHigh(_Symbol, PERIOD_M5, 2);
   double h1b = iHigh(_Symbol, PERIOD_M5, 1);
   bool bull = (l2 < l3 && l2 < l1);
   bool bear = (h2 > h3 && h2 > h1b);
   if(bull && InpAllowBull)
     {
      g_state = ST_WAIT_C4;
      g_dir = 1;
      g_swing = l2;
      g_c3ext = h1b;
      g_fibEnd = g_swing;
      g_c4ok = false;
      g_rangeHalt = false;
      g_seqLossR = 0;
      return;
     }
   if(bear && InpAllowBear)
     {
      g_state = ST_WAIT_C4;
      g_dir = -1;
      g_swing = h2;
      g_c3ext = l1;
      g_fibEnd = g_swing;
      g_c4ok = false;
      g_rangeHalt = false;
      g_seqLossR = 0;
      return;
     }
   if(g_state == ST_WAIT_C4)
     {
      if(g_c4ok)
        {
         g_state = ST_TRACK;
         if(g_dir == 1)
            g_fibEnd = MathMax(g_fibEnd, h1b);
         else
            g_fibEnd = MathMin(g_fibEnd, l1);
        }
      else
         ResetRange();
      return;
     }
   if(g_state == ST_TRACK || g_state == ST_ARMED)
     {
      if(g_dir == 1)
         g_fibEnd = MathMax(g_fibEnd, h1b);
      else
         g_fibEnd = MathMin(g_fibEnd, l1);
     }
  }

void UpdateFormingFib()
  {
   if(g_state != ST_WAIT_C4 && g_state != ST_TRACK && g_state != ST_ARMED)
      return;
   double hi = iHigh(_Symbol, PERIOD_M5, 0);
   double lo = iLow(_Symbol, PERIOD_M5, 0);
   if(g_dir == 1)
     {
      if(g_state == ST_WAIT_C4 && hi > g_c3ext)
        {
         g_c4ok = true;
         g_fibEnd = MathMax(g_fibEnd, hi);
        }
      else if(g_state == ST_TRACK || g_state == ST_ARMED)
         g_fibEnd = MathMax(g_fibEnd, hi);
     }
   else if(g_dir == -1)
     {
      if(g_state == ST_WAIT_C4 && lo < g_c3ext)
        {
         g_c4ok = true;
         g_fibEnd = MathMin(g_fibEnd, lo);
        }
      else if(g_state == ST_TRACK || g_state == ST_ARMED)
         g_fibEnd = MathMin(g_fibEnd, lo);
     }
  }

void OnScalpClosed()
  {
   if(g_state != ST_WAIT_C4 && g_state != ST_TRACK)
      return;
   if(!g_c4ok && g_state != ST_TRACK)
      return;
   if(g_fibEnd == g_swing)
      return;
   double mid = 0.5 * (g_swing + g_fibEnd);
   double cl = iClose(_Symbol, PERIOD_M1, 1);
   if(g_dir == 1 && cl < mid)
      g_state = ST_ARMED;
   if(g_dir == -1 && cl > mid)
      g_state = ST_ARMED;
  }

bool InSession(const datetime t)
  {
   MqlDateTime dt;
   TimeToStruct(t, dt);
   int h = dt.hour;
   if(InpTradeFromHour == InpTradeToHour)
      return true;
   if(InpTradeFromHour < InpTradeToHour)
      return (h >= InpTradeFromHour && h < InpTradeToHour);
   return (h >= InpTradeFromHour || h < InpTradeToHour);
  }

bool IsNewsHour(const datetime t)
  {
   if(!InpUseNewsFilter)
      return false;
   datetime hour = t - (t % PeriodSeconds(PERIOD_H1));
   int pad = MathMax(0, InpNewsPadHours);
   int n = ArraySize(g_news);
   for(int i = 0; i < n; i++)
     {
      string parts[];
      if(StringSplit(g_news[i], '|', parts) < 1)
         continue;
      datetime news = StringToTime(parts[0]);
      if(news <= 0)
         continue;
      datetime newsH1 = news - (news % PeriodSeconds(PERIOD_H1));
      datetime until = newsH1 + PeriodSeconds(PERIOD_H1) * (1 + pad);
      if(hour >= newsH1 && hour < until)
         return true;
     }
   return false;
  }

bool HasOpen()
  {
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      return true;
     }
   return false;
  }

void TryM1Sweep()
  {
   if(g_state != ST_ARMED)
      return;
   if(g_rangeHalt)
      return;
   if(InpOneTradePerM1 && g_didM1)
      return;
   if(InpOnePositionOnly && HasOpen())
      return;
   if(!InSession(g_scTime) || IsNewsHour(g_scTime))
      return;
   if(InpMaxSpreadPoints > 0)
     {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      int spr = (int)MathRound((ask - bid) / g_point);
      if(spr > InpMaxSpreadPoints)
         return;
     }
   double prevHigh = iHigh(_Symbol, PERIOD_M1, 1);
   double prevLow  = iLow(_Symbol, PERIOD_M1, 1);
   double curOpen  = iOpen(_Symbol, PERIOD_M1, 0);
   double curHigh  = iHigh(_Symbol, PERIOD_M1, 0);
   double curLow   = iLow(_Symbol, PERIOD_M1, 0);
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(prevHigh <= 0 || curOpen <= 0)
      return;
   if(g_dir == 1)
     {
      bool swept = (curLow < prevLow && curLow < curOpen);
      if(swept && bid >= curOpen)
         OpenSweep(true, curLow);
     }
   else if(g_dir == -1)
     {
      bool swept = (curHigh > prevHigh && curHigh > curOpen);
      if(swept && bid <= curOpen)
         OpenSweep(false, curHigh);
     }
  }

bool OpenSweep(const bool buy, const double extreme)
  {
   g_didM1 = true;
   double sl = buy ? (extreme - InpSLBufferPoints * g_point)
                   : (extreme + InpSLBufferPoints * g_point);
   sl = PadStop(buy, sl);
   double entry = buy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                      : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double risk = buy ? (entry - sl) : (sl - entry);
   if(risk <= 0 || risk < InpMinRiskPrice)
      return false;
   if(InpMaxRiskPrice > 0 && risk > InpMaxRiskPrice)
      return false;
   double tp = buy ? (entry + InpRewardR * risk) : (entry - InpRewardR * risk);
   sl = NormalizeDouble(sl, g_digits);
   tp = NormalizeDouble(tp, g_digits);
   double lot = CalcLot(buy, entry, sl);
   if(lot <= 0)
      return false;
   bool ok = buy ? g_trade.Buy(lot, _Symbol, 0, sl, tp, InpComment)
                 : g_trade.Sell(lot, _Symbol, 0, sl, tp, InpComment);
   if(!ok)
     {
      g_didM1 = false;
      Print("Order failed ", g_trade.ResultRetcode(), " ", g_trade.ResultComment());
      return false;
     }
   Print(buy ? "BUY " : "SELL ", DoubleToString(lot, 2),
         " SL=", DoubleToString(sl, g_digits),
         " TP=", DoubleToString(tp, g_digits));
   return true;
  }

void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD)
      return;
   if(!HistoryDealSelect(trans.deal))
      return;
   if(HistoryDealGetString(trans.deal, DEAL_SYMBOL) != _Symbol)
      return;
   if((ulong)HistoryDealGetInteger(trans.deal, DEAL_MAGIC) != InpMagic)
      return;
   if(HistoryDealGetInteger(trans.deal, DEAL_ENTRY) != DEAL_ENTRY_OUT)
      return;
   double profit = HistoryDealGetDouble(trans.deal, DEAL_PROFIT)
                   + HistoryDealGetDouble(trans.deal, DEAL_SWAP)
                   + HistoryDealGetDouble(trans.deal, DEAL_COMMISSION);
   if(profit > 0)
      g_seqLossR = 0;
   else
     {
      g_seqLossR += 1.0;
      if(InpMaxSeqR > 0 && g_seqLossR >= InpMaxSeqR)
        {
         g_rangeHalt = true;
         Print("range halt: sequential -", DoubleToString(g_seqLossR, 1), "R");
        }
     }
  }

double PadStop(const bool buy, double sl)
  {
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   int freeze = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   double minDist = MathMax(g_stopsLevel, freeze) * g_point;
   if(minDist <= 0)
      minDist = g_point;
   if(buy)
     {
      double maxSl = bid - minDist;
      if(sl > maxSl)
         sl = maxSl;
     }
   else
     {
      double minSl = ask + minDist;
      if(sl < minSl)
         sl = minSl;
     }
   return sl;
  }

double CalcLot(const bool buy, const double entry, const double sl)
  {
   double vmin = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
   if(step <= 0)
      step = vmin;
   if(vmin <= 0)
      vmin = 0.01;
   double equity = AccountInfoDouble(ACCOUNT_EQUITY);
   double lot = InpFixedLot;
   if(InpLotMode == LOT_RISK_PERCENT || InpLotMode == LOT_MONEY)
     {
      double tickVal  = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_VALUE);
      double tickSize = SymbolInfoDouble(_Symbol, SYMBOL_TRADE_TICK_SIZE);
      if(tickVal <= 0 || tickSize <= 0)
         return vmin;
      double moneyRisk = (InpLotMode == LOT_MONEY) ? InpRiskMoney
                                                   : equity * InpRiskPercent / 100.0;
      if(InpMaxRiskPctEquity > 0 && equity > 0)
        {
         double cap = equity * InpMaxRiskPctEquity / 100.0;
         if(moneyRisk > cap)
            moneyRisk = cap;
        }
      double slTicks = MathAbs(entry - sl) / tickSize;
      if(slTicks <= 0)
         return 0;
      lot = moneyRisk / (slTicks * tickVal);
      if(InpSkipIfMinLotOver && lot < vmin)
         return 0;
     }
   lot = MathFloor(lot / step) * step;
   if(lot < vmin)
      lot = vmin;
   if(lot > vmax)
      lot = vmax;
   ENUM_ORDER_TYPE typ = buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
   double free = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
   if(free <= 0)
      free = equity;
   while(lot >= vmin)
     {
      double margin = 0;
      if(!OrderCalcMargin(typ, _Symbol, lot, entry, margin))
         break;
      if(margin <= 0 || margin <= free * 0.5)
         break;
      lot = NormalizeDouble(lot - step, 2);
     }
   if(lot < vmin)
      return 0;
   return NormalizeDouble(lot, 2);
  }

void DrawLevels()
  {
   if(!InpDrawLevels || g_state == ST_IDLE)
     {
      ObjectDelete(0, g_pfx + "Swing");
      ObjectDelete(0, g_pfx + "End");
      ObjectDelete(0, g_pfx + "Mid");
      return;
     }
   color cSwing = (g_dir == 1) ? clrDodgerBlue : clrTomato;
   color cEnd   = (g_dir == 1) ? clrTomato : clrDodgerBlue;
   HLine("Swing", g_swing, cSwing);
   HLine("End", g_fibEnd, cEnd);
   HLine("Mid", 0.5 * (g_swing + g_fibEnd), clrGold);
  }

void HLine(const string tag, const double price, const color clr)
  {
   string name = g_pfx + tag;
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
     }
   ObjectSetDouble(0, name, OBJPROP_PRICE, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
  }

void UpdatePanel()
  {
   if(!InpShowPanel)
      return;
   string st = "idle";
   if(g_state == ST_WAIT_C4)
      st = g_c4ok ? "C4 expanding" : "waiting C4 > C3 extreme";
   else if(g_state == ST_TRACK)
      st = "tracking fib — wait M1 close through 50%";
   else if(g_state == ST_ARMED)
      st = (g_dir == 1) ? "ARMED M1 buys" : "ARMED M1 sells";
   if(g_rangeHalt)
      st = "HALTED (−2R sequential this range)";
   string side = (g_dir == 1) ? "BULL" : (g_dir == -1) ? "BEAR" : "-";
   double mid = 0.5 * (g_swing + g_fibEnd);
   Comment(
      "M5 Range -> M1 Sweep  ", _Symbol, "\n",
      side, "  ", st, "\n",
      "Swing ", DoubleToString(g_swing, g_digits),
      "  Ext ", DoubleToString(g_fibEnd, g_digits),
      "  50% ", DoubleToString(mid, g_digits)
   );
  }
//+------------------------------------------------------------------+
