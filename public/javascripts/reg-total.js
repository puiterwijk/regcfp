// registration-total: calculates total payment for registration and purchases.
//
// To use this in your registration form, you need to add this to your
// layouts/main.hbs template inside the <head> block:
//
//   <script type="text/javascript" src="/javascripts/reg-total.js"></script>
//
// To show the total, add an element with ID "reg-total" to the registration
// form, like in the following example:
//
//   <tr><td>Total to pay</td><td id="reg-total">0</td></tr>


var calculate_total_string = function() {
	var currency_element = $( 'select#reg-currency option:selected' );
	var currency_symbol = currency_element.data('symbol');
	var currency_conversion_rate = currency_element.data('conversion-rate');

	// If the regfee element is disabled, the reg fee was already paid.
	var amount = parseFloat($( '#reg-fee[disabled!="disabled"]' ).val()) || 0;

	$( 'input.purchase-option:checked ').each(function() {
		if ($(this).data('payment-state') == 'unpaid')
			amount += $(this).data('cost') * currency_conversion_rate;
	});

	return currency_symbol + amount.toFixed(2);
}

var update_total = function(amount) {
	$( '#reg-total' ).text(amount);
}

$(function() {
	update_total(calculate_total_string());

	$( '#reg-currency' ).change( function() {
		update_total(calculate_total_string());
	} );

	$( '#reg-fee' ).change( function() {
		update_total(calculate_total_string());
	} );

	$( 'input.purchase-option ' ).change( function() {
		update_total(calculate_total_string());
	} );
} );
