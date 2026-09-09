//+------------------------------------------------------------------+
//|                                 XAUUSD_H1Swing_M5Break_v2.mq5    |
//|  H1 3-bar high/low. When price trades back through that level,   |
//|  M5 first swing on the approach is the trigger. Close through    |
//|  it, then limit at that swing. SL = last M5 extreme beyond the   |
//|  H1 level. Skip if 2+ M5 swing extremes printed beyond the H1    |
//|  level before the trigger. TP 2.5R.                              |
//+------------------------------------------------------------------+
#property copyright "ExnessfxBot"
#property version   "2.00"
#property description "v2: honours InpSkipIfMinLotOver, rule-based NFP block. TP 2.5R."
#property strict

#include <Trade\Trade.mqh>

enum ENUM_LOT_MODE
  {
   LOT_RISK_PERCENT = 0,
   LOT_FIXED        = 1,
   LOT_MONEY        = 2
  };

input group "=== Strategy ==="
input double            InpRewardR            = 2.5;
input bool              InpAllowSell          = true;
input bool              InpAllowBuy           = true;
input bool              InpOnePositionOnly    = true;
input int               InpLookbackM5         = 80;
input int               InpSLBufferPoints     = 30;
input double            InpMinRiskPrice       = 0.30;
input double            InpMaxRiskPrice       = 80.0;

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
input ulong             InpMagic              = 260920;
input int               InpDeviationPoints    = 30;
input string            InpComment            = "H1M5Brk2";

input group "=== Display ==="
input bool              InpDrawLevels         = true;
input bool              InpShowPanel          = true;

CTrade   g_trade;
int      g_digits = 2;
double   g_point  = 0.01;
int      g_stopsLevel = 0;
string   g_pfx = "H1B5v2_";
datetime g_h1Time = 0;
datetime g_m5Time = 0;

double   g_h1High = 0;
double   g_h1Low  = 0;
double   g_usedHigh = 0;
double   g_usedLow  = 0;

enum ENUM_SETUP
  {
   SU_IDLE  = 0,
   SU_WATCH = 1,
   SU_LIMIT = 2
  };

ENUM_SETUP g_sell = SU_IDLE;
double   g_sellLevel = 0;
double   g_sellOrigin = 0;
double   g_sellSL = 0;
datetime g_sellOriginT = 0;
datetime g_sellThroughT = 0;
datetime g_sellArmT = 0;

ENUM_SETUP g_buy = SU_IDLE;
double   g_buyLevel = 0;
double   g_buyOrigin = 0;
double   g_buySL = 0;
datetime g_buyOriginT = 0;
datetime g_buyThroughT = 0;
datetime g_buyArmT = 0;

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
   g_h1Time = iTime(_Symbol, PERIOD_H1, 0);
   g_m5Time = iTime(_Symbol, PERIOD_M5, 0);
   if(InpUseNewsFilter)
     {
      datetime last = NewsTableEnd();
      if(last > 0 && TimeCurrent() > last)
         PrintFormat("WARNING: news table ends %s. Only the rule-based NFP block is active past that date - extend g_news.",
                     TimeToString(last, TIME_DATE));
     }
   return INIT_SUCCEEDED;
  }

void OnDeinit(const int reason)
  {
   ObjectsDeleteAll(0, g_pfx);
   Comment("");
  }

void OnTick()
  {
   datetime h1 = iTime(_Symbol, PERIOD_H1, 0);
   datetime m5 = iTime(_Symbol, PERIOD_M5, 0);
   if(h1 == 0 || m5 == 0)
      return;
   if(h1 != g_h1Time)
     {
      OnH1Closed();
      g_h1Time = h1;
     }
   if(m5 != g_m5Time)
     {
      OnM5Closed();
      g_m5Time = m5;
     }
   CheckCross();
   DrawLevels();
   UpdatePanel();
  }

void ResetSell()
  {
   g_sell = SU_IDLE;
   g_sellLevel = 0;
   g_sellOrigin = 0;
   g_sellSL = 0;
   g_sellOriginT = 0;
   g_sellThroughT = 0;
   g_sellArmT = 0;
   CancelPending(ORDER_TYPE_SELL_LIMIT);
  }

void ResetBuy()
  {
   g_buy = SU_IDLE;
   g_buyLevel = 0;
   g_buyOrigin = 0;
   g_buySL = 0;
   g_buyOriginT = 0;
   g_buyThroughT = 0;
   g_buyArmT = 0;
   CancelPending(ORDER_TYPE_BUY_LIMIT);
  }

void OnH1Closed()
  {
   double l3 = iLow(_Symbol, PERIOD_H1, 3);
   double l2 = iLow(_Symbol, PERIOD_H1, 2);
   double l1 = iLow(_Symbol, PERIOD_H1, 1);
   double h3 = iHigh(_Symbol, PERIOD_H1, 3);
   double h2 = iHigh(_Symbol, PERIOD_H1, 2);
   double h1b = iHigh(_Symbol, PERIOD_H1, 1);
   if(h2 > h3 && h2 > h1b)
     {
      g_h1High = h2;
      ResetSell();
     }
   if(l2 < l3 && l2 < l1)
     {
      g_h1Low = l2;
      ResetBuy();
     }
  }

int ThroughShift(const bool sell, const double level)
  {
   int n = InpLookbackM5;
   int sh = 0;
   bool any = false;
   for(; sh <= n; sh++)
     {
      bool thru = sell ? (iHigh(_Symbol, PERIOD_M5, sh) > level)
                       : (iLow(_Symbol, PERIOD_M5, sh) < level);
      if(!thru)
         break;
      any = true;
     }
   if(!any)
      return 0;
   return sh - 1;
  }

bool IsSwingLowM5(const int sh)
  {
   if(sh < 2)
      return false;
   double left  = iLow(_Symbol, PERIOD_M5, sh + 1);
   double mid   = iLow(_Symbol, PERIOD_M5, sh);
   double right = iLow(_Symbol, PERIOD_M5, sh - 1);
   if(left <= 0 || mid <= 0 || right <= 0)
      return false;
   return (mid < left && mid < right);
  }

bool IsSwingHighM5(const int sh)
  {
   if(sh < 2)
      return false;
   double left  = iHigh(_Symbol, PERIOD_M5, sh + 1);
   double mid   = iHigh(_Symbol, PERIOD_M5, sh);
   double right = iHigh(_Symbol, PERIOD_M5, sh - 1);
   if(left <= 0 || mid <= 0 || right <= 0)
      return false;
   return (mid > left && mid > right);
  }

bool FirstSwingLowBack(const int through_sh, double &price, datetime &when)
  {
   int n = InpLookbackM5;
   for(int sh = through_sh + 2; sh <= through_sh + 2 + n; sh++)
     {
      if(!IsSwingLowM5(sh))
         continue;
      price = iLow(_Symbol, PERIOD_M5, sh);
      when = iTime(_Symbol, PERIOD_M5, sh);
      return true;
     }
   return false;
  }

bool FirstSwingHighBack(const int through_sh, double &price, datetime &when)
  {
   int n = InpLookbackM5;
   for(int sh = through_sh + 2; sh <= through_sh + 2 + n; sh++)
     {
      if(!IsSwingHighM5(sh))
         continue;
      price = iHigh(_Symbol, PERIOD_M5, sh);
      when = iTime(_Symbol, PERIOD_M5, sh);
      return true;
     }
   return false;
  }

int CountSwingHighsAbove(const datetime fromT, const double level)
  {
   int n = 0;
   int bars = InpLookbackM5 * 3;
   for(int sh = 2; sh <= bars; sh++)
     {
      datetime t = iTime(_Symbol, PERIOD_M5, sh);
      if(t < fromT)
         break;
      if(IsSwingHighM5(sh) && iHigh(_Symbol, PERIOD_M5, sh) > level)
         n++;
     }
   return n;
  }

int CountSwingLowsBelow(const datetime fromT, const double level)
  {
   int n = 0;
   int bars = InpLookbackM5 * 3;
   for(int sh = 2; sh <= bars; sh++)
     {
      datetime t = iTime(_Symbol, PERIOD_M5, sh);
      if(t < fromT)
         break;
      if(IsSwingLowM5(sh) && iLow(_Symbol, PERIOD_M5, sh) < level)
         n++;
     }
   return n;
  }

double LastSwingHighAbove(const datetime fromT, const datetime untilT, const double level)
  {
   double last = 0;
   int bars = InpLookbackM5 * 3;
   for(int sh = 2; sh <= bars; sh++)
     {
      datetime t = iTime(_Symbol, PERIOD_M5, sh);
      if(t == 0)
         continue;
      if(t > untilT)
         continue;
      if(t < fromT)
         break;
      if(IsSwingHighM5(sh) && iHigh(_Symbol, PERIOD_M5, sh) > level)
        {
         last = iHigh(_Symbol, PERIOD_M5, sh);
         break;
        }
     }
   if(last > 0)
      return last;
   double mx = 0;
   for(int sh = 0; sh <= bars; sh++)
     {
      datetime t = iTime(_Symbol, PERIOD_M5, sh);
      if(t == 0)
         continue;
      if(t > untilT)
         continue;
      if(t < fromT)
         break;
      double h = iHigh(_Symbol, PERIOD_M5, sh);
      if(h > level && h > mx)
         mx = h;
     }
   return mx;
  }

double LastSwingLowBelow(const datetime fromT, const datetime untilT, const double level)
  {
   double last = 0;
   int bars = InpLookbackM5 * 3;
   for(int sh = 2; sh <= bars; sh++)
     {
      datetime t = iTime(_Symbol, PERIOD_M5, sh);
      if(t == 0)
         continue;
      if(t > untilT)
         continue;
      if(t < fromT)
         break;
      if(IsSwingLowM5(sh) && iLow(_Symbol, PERIOD_M5, sh) < level)
        {
         last = iLow(_Symbol, PERIOD_M5, sh);
         break;
        }
     }
   if(last > 0)
      return last;
   double mn = 0;
   for(int sh = 0; sh <= bars; sh++)
     {
      datetime t = iTime(_Symbol, PERIOD_M5, sh);
      if(t == 0)
         continue;
      if(t > untilT)
         continue;
      if(t < fromT)
         break;
      double l = iLow(_Symbol, PERIOD_M5, sh);
      if(l < level && (mn == 0 || l < mn))
         mn = l;
     }
   return mn;
  }

void CheckCross()
  {
   double hi = iHigh(_Symbol, PERIOD_H1, 0);
   double lo = iLow(_Symbol, PERIOD_H1, 0);
   if(InpAllowSell && g_h1High > 0 && g_sell == SU_IDLE && hi > g_h1High && g_h1High != g_usedHigh)
     {
      g_usedHigh = g_h1High;
      double origin = 0;
      datetime ot = 0;
      int thru = ThroughShift(true, g_h1High);
      if(FirstSwingLowBack(thru, origin, ot))
        {
         g_sell = SU_WATCH;
         g_sellLevel = g_h1High;
         g_sellOrigin = origin;
         g_sellOriginT = ot;
         g_sellThroughT = iTime(_Symbol, PERIOD_M5, thru);
        }
     }
   if(InpAllowBuy && g_h1Low > 0 && g_buy == SU_IDLE && lo < g_h1Low && g_h1Low != g_usedLow)
     {
      g_usedLow = g_h1Low;
      double origin = 0;
      datetime ot = 0;
      int thru = ThroughShift(false, g_h1Low);
      if(FirstSwingHighBack(thru, origin, ot))
        {
         g_buy = SU_WATCH;
         g_buyLevel = g_h1Low;
         g_buyOrigin = origin;
         g_buyOriginT = ot;
         g_buyThroughT = iTime(_Symbol, PERIOD_M5, thru);
        }
     }
  }

void OnM5Closed()
  {
   double cl = iClose(_Symbol, PERIOD_M5, 1);
   if(g_sell == SU_WATCH && cl < g_sellOrigin)
     {
      int n = CountSwingHighsAbove(g_sellOriginT, g_sellLevel);
      if(n >= 2)
        {
         Print("sell skip: ", n, " M5 highs above H1 high");
         ResetSell();
        }
      else
        {
         datetime untilT = (g_sellThroughT > 0 ? g_sellThroughT : iTime(_Symbol, PERIOD_M5, 1));
         double slh = LastSwingHighAbove(g_sellOriginT, untilT, g_sellLevel);
         if(slh <= g_sellOrigin)
            ResetSell();
         else
           {
            g_sell = SU_LIMIT;
            g_sellSL = slh;
            g_sellArmT = iTime(_Symbol, PERIOD_M5, 1);
            PlaceLimit(false);
           }
        }
     }
   if(g_buy == SU_WATCH && cl > g_buyOrigin)
     {
      int n = CountSwingLowsBelow(g_buyOriginT, g_buyLevel);
      if(n >= 2)
        {
         Print("buy skip: ", n, " M5 lows below H1 low");
         ResetBuy();
        }
      else
        {
         datetime untilT = (g_buyThroughT > 0 ? g_buyThroughT : iTime(_Symbol, PERIOD_M5, 1));
         double sll = LastSwingLowBelow(g_buyOriginT, untilT, g_buyLevel);
         if(sll <= 0 || sll >= g_buyOrigin)
            ResetBuy();
         else
           {
            g_buy = SU_LIMIT;
            g_buySL = sll;
            g_buyArmT = iTime(_Symbol, PERIOD_M5, 1);
            PlaceLimit(true);
           }
        }
     }
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

//  First Friday of the month is the US payrolls release: 13:30 UTC on EST,
//  12:30 UTC on EDT. Block both candidate hours plus the pad so the filter
//  keeps working after the hardcoded table below runs out.
bool IsNfpH1(const datetime hour)
  {
   MqlDateTime dt;
   TimeToStruct(hour, dt);
   MqlDateTime f = dt;
   f.day = 1;
   f.hour = 0;
   f.min = 0;
   f.sec = 0;
   datetime first = StructToTime(f);
   MqlDateTime fd;
   TimeToStruct(first, fd);
   int fridayDay = 1 + ((5 - fd.day_of_week) + 7) % 7;
   if(dt.day != fridayDay)
      return false;
   int pad = MathMax(0, InpNewsPadHours);
   return (dt.hour >= 12 && dt.hour <= 13 + pad);
  }

datetime NewsTableEnd()
  {
   datetime last = 0;
   int n = ArraySize(g_news);
   for(int i = 0; i < n; i++)
     {
      string parts[];
      if(StringSplit(g_news[i], '|', parts) < 1)
         continue;
      datetime d = StringToTime(parts[0]);
      if(d > last)
         last = d;
     }
   return last;
  }

bool IsNewsHour(const datetime t)
  {
   if(!InpUseNewsFilter)
      return false;
   datetime hour = t - (t % PeriodSeconds(PERIOD_H1));
   if(IsNfpH1(hour))
      return true;
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

void CancelPending(const ENUM_ORDER_TYPE typ)
  {
   for(int i = OrdersTotal() - 1; i >= 0; i--)
     {
      ulong t = OrderGetTicket(i);
      if(t == 0)
         continue;
      if(OrderGetString(ORDER_SYMBOL) != _Symbol)
         continue;
      if((ulong)OrderGetInteger(ORDER_MAGIC) != InpMagic)
         continue;
      if((ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE) != typ)
         continue;
      g_trade.OrderDelete(t);
     }
  }

void PlaceLimit(const bool buy)
  {
   if(InpOnePositionOnly && HasOpen())
      return;
   if(!InSession(TimeCurrent()) || IsNewsHour(TimeCurrent()))
      return;
   if(InpMaxSpreadPoints > 0)
     {
      double bid = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      double ask = SymbolInfoDouble(_Symbol, SYMBOL_ASK);
      int spr = (int)MathRound((ask - bid) / g_point);
      if(spr > InpMaxSpreadPoints)
         return;
     }
   double entry = buy ? g_buyOrigin : g_sellOrigin;
   double slraw = buy ? g_buySL : g_sellSL;
   double sl = buy ? (slraw - InpSLBufferPoints * g_point)
                   : (slraw + InpSLBufferPoints * g_point);
   sl = PadStop(buy, sl, entry);
   double risk = buy ? (entry - sl) : (sl - entry);
   if(risk <= 0 || risk < InpMinRiskPrice)
      return;
   if(InpMaxRiskPrice > 0 && risk > InpMaxRiskPrice)
      return;
   double tp = buy ? (entry + InpRewardR * risk) : (entry - InpRewardR * risk);
   sl = NormalizeDouble(sl, g_digits);
   tp = NormalizeDouble(tp, g_digits);
   entry = NormalizeDouble(entry, g_digits);
   double lot = CalcLot(buy, entry, sl);
   if(lot <= 0)
      return;
   bool ok = buy ? g_trade.BuyLimit(lot, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, InpComment)
                 : g_trade.SellLimit(lot, entry, _Symbol, sl, tp, ORDER_TIME_GTC, 0, InpComment);
   if(!ok)
      Print("Limit failed ", g_trade.ResultRetcode(), " ", g_trade.ResultComment());
  }

double PadStop(const bool buy, double sl, const double entry)
  {
   int freeze = (int)SymbolInfoInteger(_Symbol, SYMBOL_TRADE_FREEZE_LEVEL);
   double minDist = MathMax(g_stopsLevel, freeze) * g_point;
   if(minDist <= 0)
      minDist = g_point;
   if(buy)
     {
      double maxSl = entry - minDist;
      if(sl > maxSl)
         sl = maxSl;
     }
   else
     {
      double minSl = entry + minDist;
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
      if(lot < vmin)
        {
         if(InpSkipIfMinLotOver)
           {
            PrintFormat("skip: min lot %.2f risks %.2f, budget is %.2f",
                        vmin, slTicks * tickVal * vmin, moneyRisk);
            return 0;
           }
         lot = vmin;
        }
     }
   lot = MathFloor(lot / step) * step;
   if(lot < vmin)
     {
      if(InpSkipIfMinLotOver && InpLotMode != LOT_FIXED)
         return 0;
      lot = vmin;
     }
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
   if(!InpDrawLevels)
     {
      ObjectDelete(0, g_pfx + "H1");
      ObjectDelete(0, g_pfx + "Origin");
      ObjectDelete(0, g_pfx + "SL");
      return;
     }
   if(g_sell != SU_IDLE)
     {
      HLine("H1", g_sellLevel, clrTomato);
      HLine("Origin", g_sellOrigin, clrGold);
      if(g_sellSL > 0)
         HLine("SL", g_sellSL, clrOrangeRed);
     }
   else if(g_buy != SU_IDLE)
     {
      HLine("H1", g_buyLevel, clrDodgerBlue);
      HLine("Origin", g_buyOrigin, clrGold);
      if(g_buySL > 0)
         HLine("SL", g_buySL, clrOrangeRed);
     }
   else
     {
      ObjectDelete(0, g_pfx + "H1");
      ObjectDelete(0, g_pfx + "Origin");
      ObjectDelete(0, g_pfx + "SL");
     }
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
   if(g_sell == SU_WATCH)
      st = "SELL watch: wait M5 close below origin low";
   else if(g_sell == SU_LIMIT)
      st = "SELL limit at M5 origin low";
   else if(g_buy == SU_WATCH)
      st = "BUY watch: wait M5 close above origin high";
   else if(g_buy == SU_LIMIT)
      st = "BUY limit at M5 origin high";
   Comment(
      "H1 swing -> M5 break  ", _Symbol, "\n",
      st, "\n",
      "H1 high ", DoubleToString(g_h1High, g_digits),
      "  H1 low ", DoubleToString(g_h1Low, g_digits)
   );
  }
//+------------------------------------------------------------------+
