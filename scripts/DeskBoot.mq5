#property copyright "ExnessfxBot"
#property version   "1.00"
#property description "Opens desk pairs and attaches FibToDesk on this portable terminal."
#property strict

input string Suffix = "";

string Pairs[4] = {"USDJPY", "XAUUSD", "EURUSD", "GBPJPY"};
bool g_done = false;

string SymbolName(const string pair)
{
   return pair + Suffix;
}

void BootCharts()
{
   if(g_done)
      return;
   int ready = 0;
   for(int i = 0; i < 4; i++)
   {
      string sym = SymbolName(Pairs[i]);
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
      int handle = iCustom(sym, PERIOD_M5, "FibToDesk");
      if(handle != INVALID_HANDLE)
      {
         ChartIndicatorAdd(chart, 0, handle);
         IndicatorRelease(handle);
      }
      ready++;
   }
   if(ready >= 4)
   {
      g_done = true;
      EventKillTimer();
   }
}

int OnInit()
{
   EventSetTimer(2);
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
}

void OnTick()
{
}
