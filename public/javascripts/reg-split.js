// Code to deal with registration splits
var opensplit = 0;
function showSplit(splitnr) {
  $(".split_" + opensplit).hide();
  $(".split_" + splitnr).show();
  opensplit = splitnr;
}

function hideAllSplits(maxsplit) {
  for(i = 1; i <= maxsplit; i++) {
    $(".split_" + i).hide();
  }
}
