#property copyright "ExnessfxBot"
#property version   "1.10"
#property description "Opens desk charts, attaches FibToDesk, and executes queued desk jobs."
#property strict

input string AccountId = "";
input string Suffix = "";
input int    Magic = 260818;
input bool   EnableGoldEa = false;

void EnsureGoldEa()
{
   if(!EnableGoldEa)
      return;
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

bool ChartHasFib(const long chart)
{
   int total = ChartIndicatorsTotal(chart, 0);
   for(int i = 0; i < total; i++)
   {
      string n = ChartIndicatorName(chart, 0, i);
      if(StringFind(n, "FibToDesk") >= 0)
         return true;
   }
   return false;
}

bool AttachFib(const long chart, const string sym)
{
   if(chart == 0 || ChartHasFib(chart))
      return true;
   ENUM_TIMEFRAMES tf = (ENUM_TIMEFRAMES)ChartPeriod(chart);
   int handle = iCustom(sym, tf, "FibToDesk");
   if(handle == INVALID_HANDLE)
      return false;
   bool ok = ChartIndicatorAdd(chart, 0, handle);
   IndicatorRelease(handle);
   if(ok)
      Print("FibToDesk attached on ", sym);
   else
      Print("FibToDesk attach failed on ", sym, " err=", GetLastError());
   return ok;
}

void BootCharts()
{
   int ready = 0;
   int fibs = 0;
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
      if(AttachFib(chart, sym))
         fibs++;
   }
   if(ready >= 4 && fibs >= 4)
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


string OrderDeskPair(const string sym)
{
   string s = sym;
   StringToUpper(s);
   if(StringFind(s, "XAUUSD") >= 0) return "XAUUSD";
   if(StringFind(s, "GBPJPY") >= 0) return "GBPJPY";
   if(StringFind(s, "USDJPY") >= 0) return "USDJPY";
   if(StringFind(s, "EURUSD") >= 0) return "EURUSD";
   return "";
}

void WriteDeskJson(const string file, const string json)
{
   int h = FileOpen(file, FILE_WRITE | FILE_REWRITE | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
   if(h == INVALID_HANDLE)
      h = FileOpen(file, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;
   FileWriteString(h, json);
   FileClose(h);
}

string DeskIsoNow()
{
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

bool IsDeskTicket(const long magic, const string comment)
{
   if(magic == Magic)
      return true;
   if(StringFind(comment, "fx:") == 0)
      return true;
   return false;
}

void ExportManualOrders()
{
   // Account-wide backup of FibToDesk order export (manual limit/market only).
   for(int p = 0; p < 4; p++)
   {
      string pair = Pairs[p];
      string want = SymOf(pair);
      datetime bestTime = 0;
      ulong bestTicket = 0;
      string bestKind = "";
      string bestSide = "";
      double bestEntry = 0;
      double bestSl = 0;
      double bestTp = 0;
      string bestSym = want;
      int digits = 5;

      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         ulong ticket = OrderGetTicket(i);
         if(ticket == 0) continue;
         string sym = OrderGetString(ORDER_SYMBOL);
         if(OrderDeskPair(sym) != pair) continue;
         if(IsDeskTicket(OrderGetInteger(ORDER_MAGIC), OrderGetString(ORDER_COMMENT))) continue;
         ENUM_ORDER_TYPE typ = (ENUM_ORDER_TYPE)OrderGetInteger(ORDER_TYPE);
         string side = "";
         string kind = "limit";
         if(typ == ORDER_TYPE_BUY_LIMIT || typ == ORDER_TYPE_BUY_STOP || typ == ORDER_TYPE_BUY_STOP_LIMIT)
            side = "buy";
         else if(typ == ORDER_TYPE_SELL_LIMIT || typ == ORDER_TYPE_SELL_STOP || typ == ORDER_TYPE_SELL_STOP_LIMIT)
            side = "sell";
         else
            continue;
         if(typ == ORDER_TYPE_BUY_STOP || typ == ORDER_TYPE_SELL_STOP ||
            typ == ORDER_TYPE_BUY_STOP_LIMIT || typ == ORDER_TYPE_SELL_STOP_LIMIT)
            kind = "stop";
         datetime t = (datetime)OrderGetInteger(ORDER_TIME_SETUP);
         if(t < bestTime) continue;
         bestTime = t;
         bestTicket = ticket;
         bestKind = kind;
         bestSide = side;
         bestEntry = OrderGetDouble(ORDER_PRICE_OPEN);
         bestSl = OrderGetDouble(ORDER_SL);
         bestTp = OrderGetDouble(ORDER_TP);
         bestSym = sym;
         digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      }

      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0) continue;
         string sym = PositionGetString(POSITION_SYMBOL);
         if(OrderDeskPair(sym) != pair) continue;
         if(IsDeskTicket(PositionGetInteger(POSITION_MAGIC), PositionGetString(POSITION_COMMENT))) continue;
         string side = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? "buy" : "sell";
         datetime t = (datetime)PositionGetInteger(POSITION_TIME);
         if(bestKind != "" && bestKind != "market" && t < bestTime) continue;
         if(t < bestTime && bestKind == "market") continue;
         bestTime = t;
         bestTicket = ticket;
         bestKind = "market";
         bestSide = side;
         bestEntry = PositionGetDouble(POSITION_PRICE_OPEN);
         bestSl = PositionGetDouble(POSITION_SL);
         bestTp = PositionGetDouble(POSITION_TP);
         bestSym = sym;
         digits = (int)SymbolInfoInteger(sym, SYMBOL_DIGITS);
      }

      string iso = DeskIsoNow();
      if(bestTicket == 0 || bestEntry <= 0 || bestSide == "" || bestSl <= 0)
      {
         string miss = "{\n";
         miss += "  \"at\": \"" + iso + "\",\n";
         miss += "  \"symbol\": \"" + want + "\",\n";
         miss += "  \"ok\": false,\n";
         miss += "  \"reason\": \"no manual order\",\n";
         miss += "  \"source\": \"order\",\n";
         miss += "  \"alreadyLive\": false\n";
         miss += "}\n";
         WriteDeskJson("exnessfxbot-order-" + pair + ".json", miss);
         continue;
      }
      double take = bestTp;
      if(take <= 0)
         take = bestEntry + 2.5 * (bestEntry - bestSl);
      string json = "{\n";
      json += "  \"at\": \"" + iso + "\",\n";
      json += "  \"symbol\": \"" + bestSym + "\",\n";
      json += "  \"ok\": true,\n";
      json += "  \"source\": \"order\",\n";
      json += "  \"alreadyLive\": true,\n";
      json += "  \"kind\": \"" + bestKind + "\",\n";
      json += "  \"ticket\": " + IntegerToString((int)bestTicket) + ",\n";
      json += "  \"side\": \"" + bestSide + "\",\n";
      json += "  \"entry\": " + DoubleToString(bestEntry, digits) + ",\n";
      json += "  \"stopLoss\": " + DoubleToString(bestSl, digits) + ",\n";
      json += "  \"takeProfit\": " + DoubleToString(take, digits) + ",\n";
      json += "  \"level05\": " + DoubleToString(bestEntry, digits) + ",\n";
      json += "  \"level1\": " + DoubleToString(bestSl, digits) + "\n";
      json += "}\n";
      WriteDeskJson("exnessfxbot-order-" + pair + ".json", json);
      WriteDeskJson("exnessfxbot-order.json", json);
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
   ExportManualOrders();
}

void OnTick()
{
}
