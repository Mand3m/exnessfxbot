//+------------------------------------------------------------------+
//|                                       XAUUSD_H1_SweepReturn.mq5  |
//|  H1 liquidity-sweep reversal for XAUUSD.                         |
//|                                                                  |
//|  SELL: current H1 trades above previous H1 High, then returns    |
//|        to this H1 Open  ->  sell. SL = current H1 High. TP = 3R. |
//|  BUY:  current H1 trades below previous H1 Low, then returns     |
//|        to this H1 Open  ->  buy.  SL = current H1 Low.  TP = 3R. |
//|                                                                  |
//|  Sweep + return must both happen before the H1 closes.           |
//|  If the hour ends without a return to Open, the setup is void.   |
//|                                                                  |
//|  Tester: use "Every tick" (or 1-minute OHLC). Open prices only   |
//|  cannot see the sweep. Attach to XAUUSD (or XAUUSDm) H1.         |
//+------------------------------------------------------------------+
#property copyright "ExnessfxBot"
#property version   "1.20"
#property description "XAUUSD H1: sweep previous High/Low then return to Open. SL at extreme, TP 3R. Session 04:00-20:00, skip high-impact news H1."
#property strict

#include <Trade\Trade.mqh>

enum ENUM_LOT_MODE
  {
   LOT_RISK_PERCENT = 0, // Risk % of equity
   LOT_FIXED        = 1, // Fixed lot size
   LOT_MONEY        = 2  // Fixed money in account currency
  };

input group "=== Strategy ==="
input double            InpRewardR            = 3.0;    // Take profit in R (risk multiples)
input double            InpMoveBEAtR          = 2.0;    // Move SL to breakeven after this many R (0 = off)
input int               InpBEBufferPoints     = 0;      // Extra points beyond entry when locking BE
input bool              InpAllowBuys          = true;   // Allow buy setups
input bool              InpAllowSells         = true;   // Allow sell setups
input bool              InpOneTradePerHour    = true;   // Max one fill per side per H1 (always enforced after a fill)
input bool              InpOnePositionOnly    = true;   // Block new entries while a position is open
input int               InpSLBufferPoints     = 30;     // Extra points beyond H1 High/Low for SL
input double            InpMinRiskPrice       = 0.30;   // Skip if SL distance smaller than this (price)
input double            InpMaxRiskPrice       = 15.0;   // Skip if SL distance larger than this (0 = off)

input group "=== Session (broker / MT5 time) ==="
input int               InpTradeFromHour      = 4;      // Allow entries from this hour (inclusive)
input int               InpTradeToHour        = 20;     // Block entries from this hour (inclusive) until TradeFrom
input bool              InpUseNewsFilter      = true;   // Skip high-impact news H1 candles
input int               InpNewsPadHours       = 1;      // Extra hours after the news H1 to also skip

input group "=== Risk ==="
input ENUM_LOT_MODE     InpLotMode            = LOT_MONEY;
input double            InpRiskPercent        = 1.0;    // Risk per trade (% of equity)
input double            InpRiskMoney          = 20000;  // Risk per trade in ACCOUNT currency (UGX live; USD if tester deposit is USD)
input double            InpMaxRiskPctEquity   = 2.0;    // Cap risk at this % of equity (0 = off). Stops "no money" on small tester deposits.
input double            InpFixedLot           = 0.01;   // Used when lot mode is fixed
input bool              InpSkipIfMinLotOver   = true;   // Skip if min lot would risk more than the capped money risk
input int               InpMaxSpreadPoints    = 80;     // Skip if spread wider than this (0 = off)
input ulong             InpMagic              = 260907; // Magic number
input int               InpDeviationPoints    = 30;     // Max slippage in points
input string            InpComment            = "H1Sweep";

input group "=== Display ==="
input bool              InpDrawLevels         = true;   // Draw prev High/Low and current Open
input bool              InpShowPanel          = true;   // On-chart status comment

CTrade   g_trade;
datetime g_h1Time      = 0;
bool     g_sweptHigh   = false;
bool     g_sweptLow    = false;
bool     g_soldHour    = false;
bool     g_boughtHour  = false;
int      g_digits      = 2;
double   g_point       = 0.01;
int      g_stopsLevel  = 0;
string   g_pfx         = "H1SR_";

// High-impact USD / gold events (broker time = Exness UTC).
// Format: "YYYY.MM.DD HH:MM|label" — the H1 that contains this stamp is blocked.
string   g_news[] =
  {
   "2026.08.03 14:00|USD ISM Manufacturing PMI",
   "2026.08.04 14:00|USD JOLTS Job Openings",
   "2026.08.05 12:15|USD ADP Non-Farm Employment",
   "2026.08.05 14:00|USD ISM Services PMI",
   "2026.08.07 12:30|USD NFP / Unemployment / AHE",
   "2026.08.12 12:30|USD CPI / Core CPI",
   "2026.08.19 18:00|USD FOMC Meeting Minutes",
   "2026.08.26 12:30|USD Core PCE / Prelim GDP",
   "2026.08.28 14:00|USD Fed Chair Warsh (Jackson Hole)"
  };

//+------------------------------------------------------------------+
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
   ApplyFilling();

   string ccy = AccountInfoString(ACCOUNT_CURRENCY);
   double eq  = AccountInfoDouble(ACCOUNT_EQUITY);
   if(InpLotMode == LOT_MONEY && InpRiskMoney > eq)
      Print("WARNING: InpRiskMoney=", DoubleToString(InpRiskMoney, 2), " ", ccy,
            " is larger than equity ", DoubleToString(eq, 2), " ", ccy,
            ". On a USD $3000 tester set InpRiskMoney to dollars (20,000 UGX ≈ 5.3 USD), not 20000. ",
            "Lot will be capped to ", DoubleToString(InpMaxRiskPctEquity, 1), "% of equity.");

   ResetHour(iTime(_Symbol, PERIOD_H1, 0));
   SyncFillsThisHour();
   DrawLevels();
   UpdatePanel("armed");

   Print("XAUUSD_H1_SweepReturn init on ", _Symbol,
         "  digits=", g_digits,
         "  point=", DoubleToString(g_point, g_digits),
         "  stops_level=", g_stopsLevel,
         "  | Tester must use Every tick / 1-minute OHLC");
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, g_pfx);
   Comment("");
  }

//+------------------------------------------------------------------+
void OnTick()
  {
   datetime h1 = iTime(_Symbol, PERIOD_H1, 0);
   if(h1 == 0)
      return;

   if(h1 != g_h1Time)
     {
      // Previous hour closed without a completed return -> setup is void.
      ResetHour(h1);
      SyncFillsThisHour();
     }

   ManageBreakeven();
   DetectSweeps();
   TryEntries();
   DrawLevels();
   UpdatePanel("");
  }

//+------------------------------------------------------------------+
void ResetHour(const datetime h1)
  {
   g_h1Time     = h1;
   g_sweptHigh  = false;
   g_sweptLow   = false;
   g_soldHour   = false;
   g_boughtHour = false;
  }

//+------------------------------------------------------------------+
void ApplyFilling()
  {
   long filling = SymbolInfoInteger(_Symbol, SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_IOC) == SYMBOL_FILLING_IOC)
      g_trade.SetTypeFilling(ORDER_FILLING_IOC);
   else if((filling & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK)
      g_trade.SetTypeFilling(ORDER_FILLING_FOK);
   else
      g_trade.SetTypeFilling(ORDER_FILLING_RETURN);
  }

//+------------------------------------------------------------------+
void DetectSweeps()
  {
   double prevHigh = iHigh(_Symbol, PERIOD_H1, 1);
   double prevLow  = iLow(_Symbol, PERIOD_H1, 1);
   double curOpen  = iOpen(_Symbol, PERIOD_H1, 0);
   double curHigh  = iHigh(_Symbol, PERIOD_H1, 0);
   double curLow   = iLow(_Symbol, PERIOD_H1, 0);
   if(prevHigh <= 0 || prevLow <= 0 || curOpen <= 0)
      return;

   // Must actually trade through the previous extreme AND away from this hour's open.
   if(curHigh > prevHigh && curHigh > curOpen)
      g_sweptHigh = true;
   if(curLow < prevLow && curLow < curOpen)
      g_sweptLow = true;
  }

//+------------------------------------------------------------------+
void ManageBreakeven()
  {
   if(InpMoveBEAtR <= 0)
      return;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl    = PositionGetDouble(POSITION_SL);
      double tp    = PositionGetDouble(POSITION_TP);
      bool buy     = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY);
      double risk  = buy ? (entry - sl) : (sl - entry);
      // Already at/beyond breakeven (SL locked at or better than entry).
      if(buy && sl >= entry - g_point)
         continue;
      if(!buy && sl > 0 && sl <= entry + g_point)
         continue;
      if(risk <= 0)
         continue;
      double r1 = buy ? (entry + InpMoveBEAtR * risk) : (entry - InpMoveBEAtR * risk);
      bool hit = buy ? (bid >= r1) : (ask <= r1);
      if(!hit)
         continue;
      double be = buy ? (entry + InpBEBufferPoints * g_point)
                      : (entry - InpBEBufferPoints * g_point);
      be = NormalizeDouble(be, g_digits);
      if(buy && be >= bid)
         continue;
      if(!buy && be <= ask)
         continue;
      if(MathAbs(be - sl) < g_point)
         continue;
      if(g_trade.PositionModify(ticket, be, tp))
         Print("BE lock ticket ", (int)ticket, " SL -> ", DoubleToString(be, g_digits),
               " after ", DoubleToString(InpMoveBEAtR, 1), "R");
     }
  }

//+------------------------------------------------------------------+
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

//+------------------------------------------------------------------+
bool IsNewsHour(const datetime h1open, string &reason)
  {
   if(!InpUseNewsFilter)
      return false;
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
      datetime until  = newsH1 + PeriodSeconds(PERIOD_H1) * (1 + pad);
      if(h1open >= newsH1 && h1open < until)
        {
         reason = (ArraySize(parts) > 1 ? parts[1] : parts[0]);
         return true;
        }
     }
   return false;
  }

//+------------------------------------------------------------------+
void TryEntries()
  {
   if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) || !MQLInfoInteger(MQL_TRADE_ALLOWED))
      return;
   if(InpOnePositionOnly && HasOpenPosition())
      return;
   if(SpreadTooWide())
      return;
   if(!InSession(g_h1Time))
      return;
   string newsWhy = "";
   if(IsNewsHour(g_h1Time, newsWhy))
      return;

   double curOpen = iOpen(_Symbol, PERIOD_H1, 0);
   double curHigh = iHigh(_Symbol, PERIOD_H1, 0);
   double curLow  = iLow(_Symbol, PERIOD_H1, 0);
   double bid     = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask     = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   if(curOpen <= 0 || bid <= 0 || ask <= 0)
      return;

   // H1 OHLC is Bid-based: "back to Open" means Bid has returned to the H1 Open.
   bool sellNow = InpAllowSells && g_sweptHigh && !g_soldHour && bid <= curOpen;
   bool buyNow  = InpAllowBuys  && g_sweptLow  && !g_boughtHour && bid >= curOpen;
   if(sellNow && buyNow)
     {
      // Same tick cannot be both a sell-return and a buy-return.
      Print("skip: both sweep-returns true at Open — ambiguous hour");
      return;
     }
   if(sellNow)
      OpenSweepTrade(false, curHigh);
   else if(buyNow)
      OpenSweepTrade(true, curLow);
  }

//+------------------------------------------------------------------+
bool OpenSweepTrade(const bool buy, const double extreme)
  {
   if(buy)
      g_boughtHour = true;
   else
      g_soldHour = true;

   double buffer = InpSLBufferPoints * g_point;
   double sl     = buy ? (extreme - buffer) : (extreme + buffer);
   sl            = PadStopForBroker(buy, sl);

   double entry = buy ? SymbolInfoDouble(_Symbol, SYMBOL_ASK)
                      : SymbolInfoDouble(_Symbol, SYMBOL_BID);
   if(entry <= 0)
      return false;

   double risk = buy ? (entry - sl) : (sl - entry);
   if(risk <= 0)
     {
      Print("skip: non-positive risk  entry=", DoubleToString(entry, g_digits),
            " sl=", DoubleToString(sl, g_digits));
      return false;
     }
   if(risk < InpMinRiskPrice)
     {
      Print("skip: risk ", DoubleToString(risk, g_digits), " < min ", DoubleToString(InpMinRiskPrice, g_digits));
      return false;
     }
   if(InpMaxRiskPrice > 0 && risk > InpMaxRiskPrice)
     {
      Print("skip: risk ", DoubleToString(risk, g_digits), " > max ", DoubleToString(InpMaxRiskPrice, g_digits));
      return false;
     }

   double tp = buy ? (entry + InpRewardR * risk) : (entry - InpRewardR * risk);
   sl = NormalizeDouble(sl, g_digits);
   tp = NormalizeDouble(tp, g_digits);

   double lot = CalcLot(buy, entry, sl);
   if(lot <= 0)
     {
      Print("skip: lot size is 0 (risk/margin does not fit this account). ",
            "Equity=", DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2), " ",
            AccountInfoString(ACCOUNT_CURRENCY),
            "  InpRiskMoney=", DoubleToString(InpRiskMoney, 2),
            "  — if tester is USD $3000, set Risk money to ~5.3 (20k UGX) or use Risk % mode.");
      return false;
     }

   g_trade.SetExpertMagicNumber(InpMagic);
   bool ok = buy ? g_trade.Buy(lot, _Symbol, 0, sl, tp, InpComment)
                 : g_trade.Sell(lot, _Symbol, 0, sl, tp, InpComment);

   if(!ok)
     {
      Print("Order failed ", g_trade.ResultRetcode(), " ", g_trade.ResultComment());
      // Allow a retry later this hour if the broker rejected the send.
      if(buy)
         g_boughtHour = false;
      else
         g_soldHour = false;
      return false;
     }

   Print((buy ? "BUY" : "SELL"),
         " ", DoubleToString(lot, 2),
         "  entry=", DoubleToString(g_trade.ResultPrice(), g_digits),
         "  SL=", DoubleToString(sl, g_digits),
         "  TP=", DoubleToString(tp, g_digits),
         "  risk=", DoubleToString(risk, g_digits),
         "  ", InpRewardR, "R",
         "  ticket=", (int)g_trade.ResultOrder());
   return true;
  }

//+------------------------------------------------------------------+
double PadStopForBroker(const bool buy, double sl)
  {
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   int freeze = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   int minPts = MathMax(g_stopsLevel, freeze);
   double minDist = minPts * g_point;
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

//+------------------------------------------------------------------+
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
      double moneyRisk = (InpLotMode == LOT_MONEY)
                         ? InpRiskMoney
                         : equity * InpRiskPercent / 100.0;
      if(InpMaxRiskPctEquity > 0 && equity > 0)
        {
         double cap = equity * InpMaxRiskPctEquity / 100.0;
         if(moneyRisk > cap)
           {
            Print("risk ", DoubleToString(moneyRisk, 2), " ", AccountInfoString(ACCOUNT_CURRENCY),
                  " exceeds ", DoubleToString(InpMaxRiskPctEquity, 1), "% of equity (",
                  DoubleToString(cap, 2), "). Capping lot.");
            moneyRisk = cap;
           }
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
     {
      Print("skip: even min lot margin does not fit free margin ",
            DoubleToString(free, 2), " ", AccountInfoString(ACCOUNT_CURRENCY),
            ". If this is a $3000 tester, set Deposit=3000 and Currency=USD (not UGX). ",
            "3000 UGX is under $1.");
      return 0;
     }
   return NormalizeDouble(lot, 2);
  }

//+------------------------------------------------------------------+
bool SpreadTooWide()
  {
   if(InpMaxSpreadPoints <= 0)
      return false;
   double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
   int spread = (int)MathRound((ask - bid) / g_point);
   return spread > InpMaxSpreadPoints;
  }

//+------------------------------------------------------------------+
bool HasOpenPosition()
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

//+------------------------------------------------------------------+
void SyncFillsThisHour()
  {
   if(g_h1Time == 0)
      return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((ulong)PositionGetInteger(POSITION_MAGIC) != InpMagic)
         continue;
      if((datetime)PositionGetInteger(POSITION_TIME) < g_h1Time)
         continue;
      if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
         g_boughtHour = true;
      else
         g_soldHour = true;
     }

   if(!HistorySelect(g_h1Time, TimeCurrent()))
      return;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong deal = HistoryDealGetTicket(i);
      if(deal == 0)
         continue;
      if(HistoryDealGetString(deal, DEAL_SYMBOL) != _Symbol)
         continue;
      if((ulong)HistoryDealGetInteger(deal, DEAL_MAGIC) != InpMagic)
         continue;
      if(HistoryDealGetInteger(deal, DEAL_ENTRY) != DEAL_ENTRY_IN)
         continue;
      long type = HistoryDealGetInteger(deal, DEAL_TYPE);
      if(type == DEAL_TYPE_BUY)
         g_boughtHour = true;
      else if(type == DEAL_TYPE_SELL)
         g_soldHour = true;
     }
  }

//+------------------------------------------------------------------+
void DrawLevels()
  {
   if(!InpDrawLevels)
      return;
   double prevHigh = iHigh(_Symbol, PERIOD_H1, 1);
   double prevLow  = iLow(_Symbol, PERIOD_H1, 1);
   double curOpen  = iOpen(_Symbol, PERIOD_H1, 0);
   datetime t0     = g_h1Time;
   datetime t1     = t0 + PeriodSeconds(PERIOD_H1);

   HLine("PrevHigh", prevHigh, clrTomato, "prev H1 High");
   HLine("PrevLow",  prevLow,  clrDodgerBlue, "prev H1 Low");
   HLine("Open",     curOpen,  clrGold, "H1 Open");

   datetime tPrev = iTime(_Symbol, PERIOD_H1, 1);
   Ray("PrevHighRay", tPrev, prevHigh, t1, prevHigh, clrTomato);
   Ray("PrevLowRay",  tPrev, prevLow,  t1, prevLow,  clrDodgerBlue);
   Ray("OpenRay",     t0,    curOpen,  t1, curOpen,  clrGold);
  }

//+------------------------------------------------------------------+
void HLine(const string tag, const double price, const color clr, const string text)
  {
   string name = g_pfx + tag;
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
      ObjectSetInteger(0, name, OBJPROP_STYLE, STYLE_DOT);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetString(0, name, OBJPROP_TOOLTIP, text);
     }
   ObjectSetDouble(0, name, OBJPROP_PRICE, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
  }

//+------------------------------------------------------------------+
void Ray(const string tag, const datetime t1, const double p1,
         const datetime t2, const double p2, const color clr)
  {
   string name = g_pfx + tag;
   if(ObjectFind(0, name) < 0)
     {
      ObjectCreate(0, name, OBJ_TREND, 0, t1, p1, t2, p2);
      ObjectSetInteger(0, name, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
     }
   ObjectMove(0, name, 0, t1, p1);
   ObjectMove(0, name, 1, t2, p2);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
  }

//+------------------------------------------------------------------+
void UpdatePanel(const string note)
  {
   if(!InpShowPanel)
      return;
   double prevHigh = iHigh(_Symbol, PERIOD_H1, 1);
   double prevLow  = iLow(_Symbol, PERIOD_H1, 1);
   double curOpen  = iOpen(_Symbol, PERIOD_H1, 0);
   double curHigh  = iHigh(_Symbol, PERIOD_H1, 0);
   double curLow   = iLow(_Symbol, PERIOD_H1, 0);
   double bid      = SymbolInfoDouble(_Symbol, SYMBOL_BID);
   string status   = note;
   if(status == "")
     {
      string newsWhy = "";
      if(HasOpenPosition())
         status = "in trade";
      else if(!InSession(g_h1Time))
         status = "session closed (no entries 20:00-04:00 MT5)";
      else if(IsNewsHour(g_h1Time, newsWhy))
         status = "news H1 blocked — " + newsWhy;
      else if(g_sweptHigh && !g_soldHour && InpAllowSells)
         status = "SELL armed — waiting return to Open";
      else if(g_sweptLow && !g_boughtHour && InpAllowBuys)
         status = "BUY armed — waiting return to Open";
      else if(g_soldHour || g_boughtHour)
         status = "already filled this H1";
      else
         status = "watching for sweep of prev High/Low";
     }

   Comment(
      "H1 Sweep-Return  ", _Symbol, "\n",
      "Hour  ", TimeToString(g_h1Time, TIME_DATE|TIME_MINUTES), "\n",
      "Prev High  ", DoubleToString(prevHigh, g_digits),
      "    Prev Low  ", DoubleToString(prevLow, g_digits), "\n",
      "Open  ", DoubleToString(curOpen, g_digits),
      "    High  ", DoubleToString(curHigh, g_digits),
      "    Low  ", DoubleToString(curLow, g_digits), "\n",
      "Sweep High  ", (g_sweptHigh ? "YES" : "no"),
      "    Sweep Low  ", (g_sweptLow ? "YES" : "no"), "\n",
      "Bid  ", DoubleToString(bid, g_digits),
      "    SL buffer  ", InpSLBufferPoints, " pts    TP  ", DoubleToString(InpRewardR, 1), "R\n",
      status
   );
  }
//+------------------------------------------------------------------+
