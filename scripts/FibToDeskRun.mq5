#property copyright "ExnessfxBot"
#property version   "1.10"
#property description "Run once after drawing Fibonacci: writes 0.5→Entry and 1.0→SL for the desk."
#property script_show_inputs

input string FileName = "exnessfxbot-fib.json";

bool LooksLikeFibo(const string name)
{
   ENUM_OBJECT typ = (ENUM_OBJECT)ObjectGetInteger(0, name, OBJPROP_TYPE);
   if(typ == OBJ_FIBO || typ == OBJ_EXPANSION)
      return true;
   string lower = name;
   StringToLower(lower);
   return (StringFind(lower, "fibo") >= 0 || StringFind(lower, "fibonacci") >= 0);
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

void OnStart()
{
   string name = LastFiboName();
   MqlDateTime dt;
   TimeToStruct(TimeGMT(), dt);
   string iso = StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                             dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
   int h = FileOpen(FileName, FILE_WRITE | FILE_REWRITE | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
   if(h == INVALID_HANDLE)
      h = FileOpen(FileName, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(h == INVALID_HANDLE)
   {
      Print("FibToDesk: cannot write ", FileName, " err=", GetLastError());
      return;
   }
   if(name == "")
   {
      FileWriteString(h, "{\n  \"at\": \"" + iso + "\",\n  \"ok\": false,\n  \"reason\": \"no fibonacci on this chart\"\n}\n");
      FileClose(h);
      Print("FibToDesk: no Fibonacci on this chart. Draw one, then run this script again.");
      return;
   }
   double p0 = ObjectGetDouble(0, name, OBJPROP_PRICE, 0);
   double p1 = ObjectGetDouble(0, name, OBJPROP_PRICE, 1);
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
   FileWriteString(h, json);
   FileClose(h);
   string pair = _Symbol;
   StringToUpper(pair);
   string desk = "";
   if(StringFind(pair, "XAUUSD") >= 0) desk = "XAUUSD";
   else if(StringFind(pair, "GBPJPY") >= 0) desk = "GBPJPY";
   else if(StringFind(pair, "USDJPY") >= 0) desk = "USDJPY";
   else if(StringFind(pair, "EURUSD") >= 0) desk = "EURUSD";
   if(desk != "")
   {
      int h2 = FileOpen("exnessfxbot-fib-" + desk + ".json", FILE_WRITE | FILE_REWRITE | FILE_TXT | FILE_ANSI | FILE_COMMON | FILE_SHARE_READ);
      if(h2 != INVALID_HANDLE)
      {
         FileWriteString(h2, json);
         FileClose(h2);
      }
   }
   Print("FibToDesk: ", desk, " 0.5=", DoubleToString(level05, _Digits), " SL=", DoubleToString(level1, _Digits), " TP=", DoubleToString(tp, _Digits));
}
