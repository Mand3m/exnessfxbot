#property copyright "ExnessfxBot"
#property version   "1.10"
#property description "Writes Fib 0.5→Entry and 1.0→SL to Common Files for the ExnessfxBot desk."
#property indicator_chart_window
#property indicator_plots 0
#property indicator_buffers 0

input string FileName = "exnessfxbot-fib.json";

int OnInit()
{
   ChartSetInteger(0, CHART_EVENT_OBJECT_CREATE, true);
   ChartSetInteger(0, CHART_EVENT_OBJECT_DELETE, true);
   EventSetMillisecondTimer(400);
   ExportFib();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
{
   return rates_total;
}

void OnTimer()
{
   ExportFib();
}

void OnChartEvent(const int id, const long &lparam, const double &dparam, const string &sparam)
{
   if(id == CHARTEVENT_OBJECT_CREATE || id == CHARTEVENT_OBJECT_CHANGE ||
      id == CHARTEVENT_OBJECT_DRAG || id == CHARTEVENT_OBJECT_ENDEDIT)
      ExportFib();
}

bool LooksLikeFibo(const string name)
{
   ENUM_OBJECT typ = (ENUM_OBJECT)ObjectGetInteger(0, name, OBJPROP_TYPE);
   if(typ == OBJ_FIBO || typ == OBJ_EXPANSION)
      return true;
   string lower = name;
   StringToLower(lower);
   if(StringFind(lower, "fibo") >= 0 || StringFind(lower, "fibonacci") >= 0)
      return typ == OBJ_FIBO || typ == OBJ_EXPANSION || typ == OBJ_TREND;
   return false;
}

string LastFiboName()
{
   string found = "";
   datetime newest = 0;
   int total = ObjectsTotal(0, -1, -1);
   for(int i = 0; i < total; i++)
   {
      string name = ObjectName(0, i, -1, -1);
      if(!LooksLikeFibo(name))
         continue;
      datetime created = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 0);
      datetime t1 = (datetime)ObjectGetInteger(0, name, OBJPROP_TIME, 1);
      if(t1 > created)
         created = t1;
      if(created >= newest)
      {
         newest = created;
         found = name;
      }
   }
   if(found != "")
      return found;

   total = ObjectsTotal(0, 0, OBJ_FIBO);
   if(total > 0)
      return ObjectName(0, total - 1, 0, OBJ_FIBO);
   return "";
}

string DeskPair()
{
   string s = _Symbol;
   StringToUpper(s);
   if(StringFind(s, "XAUUSD") >= 0) return "XAUUSD";
   if(StringFind(s, "GBPJPY") >= 0) return "GBPJPY";
   if(StringFind(s, "USDJPY") >= 0) return "USDJPY";
   if(StringFind(s, "EURUSD") >= 0) return "EURUSD";
   return "";
}

void WriteJson(const string file, const string json)
{
   int h = FileOpen(file, FILE_WRITE | FILE_REWRITE | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
   if(h == INVALID_HANDLE)
      h = FileOpen(file, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
      return;
   FileWriteString(h, json);
   FileClose(h);
}

string IsoNow()
{
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

void ExportFib()
{
   string name = LastFiboName();
   string iso = IsoNow();
   if(name == "")
   {
      WriteJson(FileName, "{\n  \"at\": \"" + iso + "\",\n  \"symbol\": \"" + _Symbol +
                "\",\n  \"ok\": false,\n  \"reason\": \"no fibonacci on this chart\"\n}\n");
      return;
   }

   double p0 = ObjectGetDouble(0, name, OBJPROP_PRICE, 0);
   double p1 = ObjectGetDouble(0, name, OBJPROP_PRICE, 1);
   if(p0 <= 0 || p1 <= 0)
      return;

   // MT5 Fibo: first click = 100% (1.0), second click = 0.0.
   // Desk: 100% → SL, 0.5 → Entry, TP = 2.5R from entry.
   double level1  = p0;
   double level05 = 0.5 * (p0 + p1);
   double tp = level05 + 2.5 * (level05 - level1);
   string side = (level1 > level05) ? "sell" : "buy";

   string json = "{\n";
   json += "  \"at\": \"" + iso + "\",\n";
   json += "  \"symbol\": \"" + _Symbol + "\",\n";
   json += "  \"ok\": true,\n";
   json += "  \"name\": \"" + name + "\",\n";
   json += "  \"side\": \"" + side + "\",\n";
   json += "  \"level05\": " + DoubleToString(level05, _Digits) + ",\n";
   json += "  \"level1\": " + DoubleToString(level1, _Digits) + ",\n";
   json += "  \"entry\": " + DoubleToString(level05, _Digits) + ",\n";
   json += "  \"stopLoss\": " + DoubleToString(level1, _Digits) + ",\n";
   json += "  \"takeProfit\": " + DoubleToString(tp, _Digits) + "\n";
   json += "}\n";
   WriteJson(FileName, json);
   string pair = DeskPair();
   if(pair != "")
      WriteJson("exnessfxbot-fib-" + pair + ".json", json);
}
