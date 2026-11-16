#property copyright "ExnessfxBot"
#property version   "1.00"
#property script_show_inputs
#property description "Attaches FibToDesk to XAUUSD, USDJPY, EURUSD, GBPJPY charts."

string Pairs[4] = {"XAUUSD", "USDJPY", "EURUSD", "GBPJPY"};

bool HasFib(const long chart)
{
   int total = ChartIndicatorsTotal(chart, 0);
   for(int i = 0; i < total; i++)
      if(StringFind(ChartIndicatorName(chart, 0, i), "FibToDesk") >= 0)
         return true;
   return false;
}

void OnStart()
{
   int attached = 0;
   for(int i = 0; i < 4; i++)
   {
      string want = Pairs[i];
      for(long ch = ChartFirst(); ch >= 0; ch = ChartNext(ch))
      {
         string sym = ChartSymbol(ch);
         string up = sym;
         StringToUpper(up);
         if(StringFind(up, want) < 0)
            continue;
         if(HasFib(ch))
         {
            Print("FibToDesk already on ", sym);
            attached++;
            continue;
         }
         ENUM_TIMEFRAMES tf = (ENUM_TIMEFRAMES)ChartPeriod(ch);
         int handle = iCustom(sym, tf, "FibToDesk");
         if(handle == INVALID_HANDLE)
         {
            Print("iCustom FibToDesk failed on ", sym, " err=", GetLastError());
            continue;
         }
         if(ChartIndicatorAdd(ch, 0, handle))
         {
            Print("attached FibToDesk on ", sym, " ", EnumToString(tf));
            attached++;
         }
         else
            Print("ChartIndicatorAdd failed on ", sym, " err=", GetLastError());
         IndicatorRelease(handle);
      }
   }
   Print("AttachFibToDesk done, charts with FibToDesk=", attached);
}
