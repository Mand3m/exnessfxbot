#property copyright "ExnessfxBot"
#property version   "1.00"
#property script_show_inputs
#property description "Opens XAUUSD M5 and attaches the H1-range M5 sweep EA. FibToDesk charts are left alone."

input string InpSymbol = "XAUUSDz";

void OnStart()
{
   string sym = InpSymbol;
   if(!SymbolSelect(sym, true))
   {
      Print("symbol missing ", sym);
      return;
   }
   long chart = 0;
   for(long ch = ChartFirst(); ch >= 0; ch = ChartNext(ch))
   {
      if(ChartSymbol(ch) == sym && ChartPeriod(ch) == PERIOD_M5)
      {
         chart = ch;
         break;
      }
   }
   if(chart == 0)
      chart = ChartOpen(sym, PERIOD_M5);
   if(chart == 0)
   {
      Print("could not open ", sym, " M5");
      return;
   }
   ChartSetInteger(chart, CHART_BRING_TO_TOP, true);
   if(ChartApplyTemplate(chart, "H1RangeM5.tpl"))
      Print("attached XAUUSD_H1Range_M5Sweep on ", sym, " M5");
   else
      Print("template failed — drag Experts\\XAUUSD_H1Range_M5Sweep onto ", sym, " M5");
}
