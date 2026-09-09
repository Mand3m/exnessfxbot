#property copyright "ExnessfxBot"
#property version   "1.10"
#property description "Opens desk charts, attaches FibToDesk, and executes queued desk jobs."
#property strict

input string AccountId = "";
input string Suffix = "";
input int    Magic = 260818;
input bool   EnableGoldEa = false;

datetime g_goldTry = 0;

void EnsureGoldEa()
{
   if(!EnableGoldEa)
      return;
   datetime now = TimeLocal();
   if(g_goldTry != 0 && now - g_goldTry < 15)
      return;
   g_goldTry = now;
   if(FileIsExist("exnessfxbot-gold-ea.on", FILE_COMMON))
   {
      long want = 0;
      int h = FileOpen("exnessfxbot-gold-ea.on", FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
      if(h != INVALID_HANDLE)
      {
         string line = FileReadString(h);
         FileClose(h);
         want = StringToInteger(line);
      }
      if(want > 0 && AccountInfoInteger(ACCOUNT_LOGIN) != want)
         return;
   }
   if(GlobalVariableCheck("H1R5_chart"))
   {
      long existing = (long)GlobalVariableGet("H1R5_chart");
      if(existing > 0 && ChartSymbol(existing) != "")
         return;
   }
   string sym = SymOf("XAUUSD");
   if(!SymbolSelect(sym, true))
      return;
   long ch = 0;
   for(long c = ChartFirst(); c >= 0; c = ChartNext(c))
   {
      if(ChartSymbol(c) == sym && ChartPeriod(c) == PERIOD_M5)
      {
         ch = c;
         break;
      }
   }
   if(ch == 0)
      ch = ChartOpen(sym, PERIOD_M5);
   if(ch == 0)
      return;
   if(!ChartApplyTemplate(ch, "H1RangeM5.tpl"))
      Print("H1RangeM5.tpl not applied — drag XAUUSD_H1Range_M5Sweep onto ", sym, " M5");
   GlobalVariableSet("H1R5_chart", (double)ch);
}

string Pairs[4] = {"USDJPY", "XAUUSD", "EURUSD", "GBPJPY"};
bool g_charts = false;

string JobFile()
{
   return "exnessfxbot-jobs-" + AccountId + ".tsv";
}

string ResultFile()
{
   return "exnessfxbot-results-" + AccountId + ".tsv";
}

string SymOf(const string pair)
{
   return pair + Suffix;
}

double PipSize(const string pair)
{
   if(pair == "XAUUSD")
      return 0.1;
   if(pair == "EURUSD")
      return 0.0001;
   return 0.01;
}

void BootCharts()
{
   if(g_charts)
      return;
   int ready = 0;
   for(int i = 0; i < 4; i++)
   {
      string sym = SymOf(Pairs[i]);
      if(!SymbolSelect(sym, true))
         continue;
      long chart = 0;
      for(long ch = ChartFirst(); ch >= 0; ch = ChartNext(ch))
      {
         if(ChartSymbol(ch) == sym)
         {
            chart = ch;
            break;
         }
      }
      if(chart == 0)
         chart = ChartOpen(sym, PERIOD_M5);
      if(chart == 0)
         continue;
      ready++;
   }
   if(ready >= 4)
      g_charts = true;
}

int Split(const string line, const ushort sep, string &parts[])
{
   int n = StringSplit(line, sep, parts);
   return n;
}

void WriteResult(const string id, const string status, const string ticket, const string message)
{
   int h = FileOpen(ResultFile(), FILE_WRITE | FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
      h = FileOpen(ResultFile(), FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;
   FileSeek(h, 0, SEEK_END);
   string safe = message;
   StringReplace(safe, "\t", " ");
   StringReplace(safe, "\n", " ");
   FileWriteString(h, id + "\t" + status + "\t" + ticket + "\t" + safe + "\n");
   FileClose(h);
}

double AutoLot(const string sym, const string pair, const double entry, const double sl, const double riskPct)
{
   double pip = PipSize(pair);
   double slPips = MathAbs(entry - sl) / pip;
   if(slPips < 0.1)
      slPips = 0.1;
   double tickVal = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_VALUE);
   double tickSize = SymbolInfoDouble(sym, SYMBOL_TRADE_TICK_SIZE);
   if(tickVal <= 0 || tickSize <= 0)
      return SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double pipVal = tickVal * (pip / tickSize);
   if(pipVal <= 0)
      return SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double risk = AccountInfoDouble(ACCOUNT_EQUITY) * riskPct / 100.0;
   double lot = risk / (slPips * pipVal);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   double vmax = SymbolInfoDouble(sym, SYMBOL_VOLUME_MAX);
   if(step <= 0)
      step = vmin;
   lot = MathFloor(lot / step) * step;
   if(lot < vmin)
      lot = vmin;
   if(lot > vmax)
      lot = vmax;
   return NormalizeDouble(lot, 2);
}

bool SendJob(const string action, const string pair, const string side, const double entry, const double tp, const double sl, const double lotIn, const double riskPct, const string signalId, string &ticket, string &message)
{
   string sym = SymOf(pair);
   if(!SymbolSelect(sym, true))
   {
      message = "symbol missing " + sym;
      return false;
   }
   MqlTick tick;
   if(!SymbolInfoTick(sym, tick))
   {
      message = "no tick " + sym;
      return false;
   }
   if(action == "cancel")
   {
      int removed = 0;
      int closed = 0;
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         ulong t = OrderGetTicket(i);
         if(t == 0)
            continue;
         string cmt = OrderGetString(ORDER_COMMENT);
         if(OrderGetInteger(ORDER_MAGIC) != Magic && StringFind(cmt, "fx:" + signalId) < 0)
            continue;
         MqlTradeRequest req;
         MqlTradeResult res;
         ZeroMemory(req);
         ZeroMemory(res);
         req.action = TRADE_ACTION_REMOVE;
         req.order = t;
         if(OrderSend(req, res))
            removed++;
      }
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong t = PositionGetTicket(i);
         if(t == 0)
            continue;
         string cmt = PositionGetString(POSITION_COMMENT);
         if(PositionGetInteger(POSITION_MAGIC) != Magic && StringFind(cmt, "fx:" + signalId) < 0)
            continue;
         MqlTradeRequest req;
         MqlTradeResult res;
         ZeroMemory(req);
         ZeroMemory(res);
         req.action = TRADE_ACTION_DEAL;
         req.symbol = PositionGetString(POSITION_SYMBOL);
         req.volume = PositionGetDouble(POSITION_VOLUME);
         req.position = t;
         req.deviation = 20;
         req.magic = Magic;
         if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
         {
            req.type = ORDER_TYPE_SELL;
            req.price = SymbolInfoDouble(req.symbol, SYMBOL_BID);
         }
         else
         {
            req.type = ORDER_TYPE_BUY;
            req.price = SymbolInfoDouble(req.symbol, SYMBOL_ASK);
         }
         if(OrderSend(req, res))
            closed++;
      }
      message = "removed " + IntegerToString(removed) + " pending, closed " + IntegerToString(closed) + " position(s)";
      ticket = "0";
      return (removed + closed) > 0;
   }

   double lot = lotIn;
   if(lot <= 0)
      lot = AutoLot(sym, pair, entry, sl, riskPct > 0 ? riskPct : 1.0);
   bool buy = (side == "buy");
   double ask = tick.ask;
   double bid = tick.bid;
   bool market = buy ? (ask <= entry) : (bid >= entry);
   MqlTradeRequest req;
   MqlTradeResult res;
   ZeroMemory(req);
   ZeroMemory(res);
   req.symbol = sym;
   req.volume = lot;
   req.sl = sl;
   req.tp = tp;
   req.deviation = 20;
   req.magic = Magic;
   req.comment = "fx:" + signalId;
   req.type_filling = ORDER_FILLING_IOC;
   if(market)
   {
      req.action = TRADE_ACTION_DEAL;
      req.type = buy ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      req.price = buy ? ask : bid;
   }
   else
   {
      req.action = TRADE_ACTION_PENDING;
      req.type = buy ? ORDER_TYPE_BUY_LIMIT : ORDER_TYPE_SELL_LIMIT;
      req.price = entry;
   }
   if(!OrderSend(req, res))
   {
      message = IntegerToString(res.retcode) + " " + res.comment;
      return false;
   }
   ticket = IntegerToString((int)res.order);
   message = (market ? "market " : "limit ") + side + " " + DoubleToString(lot, 2) + " " + sym +
             " @ " + DoubleToString(req.price, (int)SymbolInfoInteger(sym, SYMBOL_DIGITS));
   return true;
}

string SeenFile()
{
   return "exnessfxbot-seen-" + AccountId + ".txt";
}

bool AlreadyDone(const string id)
{
   int h = FileOpen(SeenFile(), FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
   if(h == INVALID_HANDLE)
      return false;
   bool found = false;
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      if(line == id)
      {
         found = true;
         break;
      }
   }
   FileClose(h);
   return found;
}

void MarkDone(const string id)
{
   int h = FileOpen(SeenFile(), FILE_WRITE | FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
      h = FileOpen(SeenFile(), FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;
   FileSeek(h, 0, SEEK_END);
   FileWriteString(h, id + "\n");
   FileClose(h);
}

void ProcessJobs()
{
   if(AccountId == "")
      return;
   int h = FileOpen(JobFile(), FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
   if(h == INVALID_HANDLE)
      return;
   while(!FileIsEnding(h))
   {
      string line = FileReadString(h);
      if(StringLen(line) < 8)
         continue;
      string p[];
      if(Split(line, '\t', p) < 10)
         continue;
      string id = p[0];
      string action = p[1];
      string pair = p[2];
      string side = p[3];
      double entry = StringToDouble(p[4]);
      double tp = StringToDouble(p[5]);
      double sl = StringToDouble(p[6]);
      double lot = StringToDouble(p[7]);
      double risk = StringToDouble(p[8]);
      string signalId = p[9];
      string status = (ArraySize(p) > 10) ? p[10] : "queued";
      if(status != "queued")
         continue;
      if(AlreadyDone(id))
         continue;
      string ticket = "0";
      string message = "";
      bool ok = SendJob(action, pair, side, entry, tp, sl, lot, risk, signalId, ticket, message);
      WriteResult(id, ok ? "sent" : (action == "cancel" ? "skipped" : "error"), ticket, message);
      MarkDone(id);
      if(ok && action == "open")
         RememberTrail((ulong)StringToInteger(ticket), pair, side, entry, sl, tp);
   }
   FileClose(h);
}

string TrailFile()
{
   return "exnessfxbot-atr-" + AccountId + ".tsv";
}

void WriteTrailRow(const ulong ticket, const string pair, const string side, const double entry, const double sl, const double tp, const int stage, const int half)
{
   int h = FileOpen(TrailFile(), FILE_WRITE | FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ | FILE_SHARE_WRITE);
   if(h == INVALID_HANDLE)
      h = FileOpen(TrailFile(), FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;
   FileSeek(h, 0, SEEK_END);
   FileWriteString(h, IntegerToString((int)ticket) + "\t" + pair + "\t" + side + "\t" +
                   DoubleToString(entry, 8) + "\t" + DoubleToString(sl, 8) + "\t" +
                   DoubleToString(tp, 8) + "\t" + IntegerToString(stage) + "\t" + IntegerToString(half) + "\n");
   FileClose(h);
}

void RememberTrail(const ulong ticket, const string pair, const string side, const double entry, const double sl, const double tp)
{
   if(AlreadyDone("t:" + IntegerToString((int)ticket)))
      return;
   WriteTrailRow(ticket, pair, side, entry, sl, tp, 0, 0);
   MarkDone("t:" + IntegerToString((int)ticket));
}

bool ModifySL(const ulong ticket, const double sl, const double tp)
{
   if(!PositionSelectByTicket(ticket))
      return false;
   MqlTradeRequest req;
   MqlTradeResult res;
   ZeroMemory(req);
   ZeroMemory(res);
   req.action = TRADE_ACTION_SLTP;
   req.position = ticket;
   req.symbol = PositionGetString(POSITION_SYMBOL);
   req.sl = sl;
   req.tp = tp;
   req.magic = Magic;
   return OrderSend(req, res);
}

bool CloseHalf(const ulong ticket)
{
   if(!PositionSelectByTicket(ticket))
      return false;
   string sym = PositionGetString(POSITION_SYMBOL);
   double vol = PositionGetDouble(POSITION_VOLUME);
   double step = SymbolInfoDouble(sym, SYMBOL_VOLUME_STEP);
   double vmin = SymbolInfoDouble(sym, SYMBOL_VOLUME_MIN);
   if(step <= 0)
      step = vmin;
   double half = MathFloor((vol / 2.0) / step) * step;
   double remain = vol - half;
   if(half < vmin || remain < vmin)
      return false;
   MqlTick tick;
   if(!SymbolInfoTick(sym, tick))
      return false;
   MqlTradeRequest req;
   MqlTradeResult res;
   ZeroMemory(req);
   ZeroMemory(res);
   req.action = TRADE_ACTION_DEAL;
   req.symbol = sym;
   req.volume = half;
   req.position = ticket;
   req.deviation = 20;
   req.magic = Magic;
   req.comment = "fx:half2r";
   if(PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY)
   {
      req.type = ORDER_TYPE_SELL;
      req.price = tick.bid;
   }
   else
   {
      req.type = ORDER_TYPE_BUY;
      req.price = tick.ask;
   }
   return OrderSend(req, res);
}

void ManageAtr()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0)
         continue;
      if(PositionGetInteger(POSITION_MAGIC) != Magic)
         continue;
      string cmt = PositionGetString(POSITION_COMMENT);
      if(StringFind(cmt, "h1r5:") == 0 || StringFind(cmt, "H1RngM5") == 0)
         continue;
      if(StringFind(cmt, "fx:") != 0 && StringFind(cmt, "fx:half") < 0)
      {
         if(PositionGetInteger(POSITION_MAGIC) != Magic)
            continue;
      }
      string sym = PositionGetString(POSITION_SYMBOL);
      string pair = "";
      if(StringFind(sym, "XAUUSD") >= 0) pair = "XAUUSD";
      else if(StringFind(sym, "GBPJPY") >= 0) pair = "GBPJPY";
      else if(StringFind(sym, "USDJPY") >= 0) pair = "USDJPY";
      else if(StringFind(sym, "EURUSD") >= 0) pair = "EURUSD";
      double entry = PositionGetDouble(POSITION_PRICE_OPEN);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      long ptype = PositionGetInteger(POSITION_TYPE);
      bool buy = (ptype == POSITION_TYPE_BUY);
      string side = buy ? "buy" : "sell";
      RememberTrail(ticket, pair, side, entry, sl, tp);

      double origSL = sl;
      int stage = 0;
      bool halfTaken = false;
      int h = FileOpen(TrailFile(), FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
      if(h != INVALID_HANDLE)
      {
         while(!FileIsEnding(h))
         {
            string line = FileReadString(h);
            string p[];
            if(Split(line, '\t', p) < 7)
               continue;
            if(StringToInteger(p[0]) != (int)ticket)
               continue;
            origSL = StringToDouble(p[4]);
            stage = (int)StringToInteger(p[6]);
            halfTaken = (ArraySize(p) > 7 && StringToInteger(p[7]) == 1);
         }
         FileClose(h);
      }
      double risk = MathAbs(entry - origSL);
      if(risk <= 0)
         continue;
      MqlTick tick;
      if(!SymbolInfoTick(sym, tick))
         continue;
      double r1 = buy ? entry + risk : entry - risk;
      double r2 = buy ? entry + 2 * risk : entry - 2 * risk;
      bool hit1 = buy ? (tick.bid >= r1 || tick.ask >= r1) : (tick.bid <= r1 || tick.ask <= r1);
      bool hit2 = buy ? (tick.bid >= r2 || tick.ask >= r2) : (tick.bid <= r2 || tick.ask <= r2);
      int digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      if(stage < 2 && hit2)
      {
         if(!halfTaken)
            CloseHalf(ticket);
         if(ModifySL(ticket, NormalizeDouble(r1, digits), tp))
            WriteTrailRow(ticket, pair, side, entry, origSL, tp, 2, 1);
      }
      else if(stage < 1 && hit1)
      {
         if(ModifySL(ticket, NormalizeDouble(entry, digits), tp))
            WriteTrailRow(ticket, pair, side, entry, origSL, tp, 1, 0);
      }
   }
}

int OnInit()
{
   EventSetTimer(1);
   BootCharts();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   BootCharts();
   EnsureGoldEa();
   ProcessJobs();
   ManageAtr();
}

void OnTick()
{
}
