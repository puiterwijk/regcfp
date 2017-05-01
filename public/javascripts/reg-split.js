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

var USDVAL = 25.00;
var BMI = {
  "Argentina": 6.7,
  "Australia": 1.1,
  "Brazil": 2.7,
  "Britain": 0.6,
  "Canada": 1.2,
  "Chile": 426.0,
  "China": 3.6,
  "Colombia": 1602.4,
  "Costa Rica": 436.1,
  "Czech Republic": 15.2,
  "Denmark": 6.1,
  "Egypt": 3.4,
  "Euro area": 0.8,
  "Hong Kong": 3.9,
  "Hungary": 182.6,
  "India": 25.8,
  "Indonesia": 6186.6,
  "Israel": 3.4,
  "Japan": 75.1,
  "Malaysia": 1.6,
  "Mexico": 9.9,
  "New Zealand": 1.2,
  "Norway": 9.5,
  "Pakistan": 60.9,
  "Peru": 2.0,
  "Philippines": 26.6,
  "Poland": 1.9,
  "Russia": 23.1,
  "Saudi Arabia": 2.4,
  "Singapore": 1.0,
  "South Africa": 5.7,
  "South Korea": 872.2,
  "Sri Lanka": 71.0,
  "Sweden": 9.1,
  "Switzerland": 1.3,
  "Taiwan": 14.0,
  "Thailand": 22.7,
  "Turkey": 2.1,
  "UAE": 2.6,
  "Ukraine": 7.3,
  "United States": 1.0,
  "Uruguay": 22.9,
  "Venezuela": 26.8,
  "Vietnam": 12170.4,
  "Austria": 0.7,
  "Belgium": 0.8,
  "Estonia": 0.6,
  "Finland": 0.8,
  "France": 0.8,
  "Germany": 0.7,
  "Greece": 0.7,
  "Ireland": 0.8,
  "Italy": 0.8,
  "Netherlands": 0.7,
  "Portugal": 0.6,
  "Spain": 0.7
};
function update_regfee() {
  var country = $("#reg-country").val();
  val = BMI[country] * USDVAL;
  $("#reg-regfee").val(val);
}
