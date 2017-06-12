// Code to deal with registration splits
var opensplit = 0;
var maxsplit = 0;
function showSplit(splitnr) {
  $(".split_" + opensplit).hide();
  $(".split_" + splitnr).show();
  if(splitnr == 0) {
    $("#split_previous").hide();
  } else {
    $("#split_previous").show();
  }
  if(splitnr == maxsplit) {
    $("#split_next").hide();
    $("#submit").show();
  } else {
    $("#split_next").show();
    $("#submit").hide();
  }
  opensplit = splitnr;
  for(var item in hideshows[opensplit]) {
    hideshows[opensplit][item]();
  }
}

function hideAllSplits(msplit) {
  maxsplit = msplit;
  for(i = 1; i <= maxsplit; i++) {
    $(".split_" + i).hide();
  }
  $("#split_previous").hide();
  if(maxsplit == 0) {
    $("#split_next").hide();
  } else {
    $("#submit").hide();
  }
}

var USDVAL = 25.00;
var BMI = {
  "Argentina": -33.6,
  "Australia": -14.6,
  "Brazil": -5.1,
  "Britain": -21.8,
  "Canada": -8.6,
  "Chile": -29.9,
  "China": -44.7,
  "Colombia": -39.7,
  "Costa Rica": -18.3,
  "Czech Republic": -39.4,
  "Denmark": -11.9,
  "Egypt": -48.6,
  "Euro area": -16.6,
  "Hong Kong": -50.9,
  "Hungary": -37.5,
  "India": -52.2,
  "Indonesia": -53.1,
  "Israel": -13.1,
  "Japan": -31.2,
  "Malaysia": -60.6,
  "Mexico": -52.9,
  "New Zealand": -16.2,
  "Norway": 9.3,
  "Pakistan": -29.0,
  "Peru": -40.0,
  "Philippines": -44.0,
  "Poland": -52.0,
  "Russia": -59.3,
  "Saudi Arabia": -36.5,
  "Singapore": -20.4,
  "South Africa": -58.3,
  "South Korea": -23.5,
  "Sri Lanka": -28.1,
  "Sweden": 3.7,
  "Switzerland": 30.8,
  "Taiwan": -57.3,
  "Thailand": -32.5,
  "Turkey": -29.9,
  "UAE": -29.8,
  "Ukraine": -68.8,
  "United States": 0.0,
  "Uruguay": -19.1,
  "Venezuela": -32.9,
  "Vietnam": -46.6,
  "Austria": -21.4,
  "Belgium": -13.7,
  "Estonia": -32.3,
  "Finland": 0.5,
  "France": -10.4,
  "Germany": -17.2,
  "Greece": -26.8,
  "Ireland": -12.6,
  "Italy": -8.3,
  "Netherlands": -24.6,
  "Portugal": -33.4,
  "Spain": -23.5
};
function update_regfee() {
  var country = $("#reg-country").val();
  val = (USDVAL / 100.0) * (100 + BMI[country]);
  $("#reg-regfee").val(val.toFixed(2));
}

function update_estimates() {
  var needassistance = $("#reg-needassistance[value='Yes, my attendance requires financial assistance.']").is(":checked");
  if(!needassistance)
    return;
  var doesair = $("#reg-flights_needed[value='My trip to Flock requires air travel.']").is(":checked");
  var airbook = 27.0;
  var airfare = parseFloat($("#reg-flight_price")[0].value.replace(",", "."));
  var busservice = $("#reg-busservice[value='Yes (+ $47 / roundtrip)']").is(":checked");
  var othertransit = parseFloat($("#reg-total_othertransit")[0].value.replace(",", "."));
  var doeslodging = $("#reg-lodging_needed[value='I would like lodging to be part of my travel funding request.']").is(":checked");
  var nights = doeslodging ? parseInt($("#reg-lodging_nights")[0].value) : 0;  // Could be NaN for "other"
  var regfee = parseFloat($("#reg-regfee")[0].value.replace(",", "."));

  if(!doesair || airfare == NaN) {
    airfare = 0.0;
    airbook = 0.0;
  }
  var busfare = busservice ? 47.0 : 0.0;
  if(othertransit == NaN)
    othertransit = 0.0;
  if(nights == NaN)
    var lodgingcost = "Custom";
  else
    var lodgingcost = nights * (139.99 + 15.40);

  var total = airfare + airbook + busfare + othertransit + lodgingcost + regfee;

  $("#estimate_airfare").text(airfare);
  $("#estimate_airfare_booking").text(airbook);
  $("#estimate_bus_service").text(busfare);
  $("#estimate_other_transit").text(othertransit);
  $("#estimate_lodging_nights").text(nights);
  $("#estimate_lodging_cost").text(lodgingcost.toFixed(2));
  $("#estimate_regfee").text(regfee);
  $("#estimate_total").text(total.toFixed(2));

  function afford(amount, percentage) {
    return ((amount/100) * (100 - percentage)).toFixed(2);
  }

  var percs = [20, 40, 60, 80, 90];
  for(var perc in percs) {
    perc = percs[perc];
    $("#reg-afford_to_pay[value='" + perc + "']")[0].nextSibling.data = "$" + afford(total, perc) + " (" + perc + "% Fedora subsidy)";
  }
}
