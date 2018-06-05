// registration-fee-slider: a visual control for the `reg-fee` field
//
// To use this in your registration form, you need to add this to your
// layouts/main.hbs template inside the <head> block:
//
//   <script type="text/javascript" src="/javascripts/reg-gnome-lunch.js"></script>
//
// The script assume a reg-lunch-dates text entry with a note underneath.
// HTML dates need to be hard-coded here (at least currently).


$(function() {
	var lunch_purchase_tables = $('table[id^=reg-lunch-]');
	console.log("asdf");

	$.each(lunch_purchase_tables, function(i, table) {
		table = $(table);

		var options = table.find('input[type=radio]');

		console.log(options);
		if (options.length != 2)
			return;

		if (options[0].value != 'None')
			return;

		var option_name = options[0].name;
		var value = 'None';
		var checked = options[1].checked;
		var disabled = options[0].disabled;
		var label = $(options[1]).parent().text();
		var price_label = table.find('.purchase-option-price').text();

		var input = $('<input type="checkbox" data-name-checked="' + options[0].name + '" data-name="' + options[1].name + '" data-value="' + options[1].value + '"/>');
		input[0].checked = checked;
		input.change(function () {
			var name = $(this).attr('data-name-checked');
			var value = $(this).attr('data-value');

			if (!this.checked)
				value = 'None';

			console.log(name, $('input[name='+ name + '][value='+ value +']'));
			$('input[name='+ name + '][value='+ value +']')[0].checked = true;
			// Trigger an explicit total cost update
			update_total(calculate_total_string());
		});
		var html = $('<label></label>');
		html.append(input);
		html.append(label);
		console.log(price_label);
		html.append(' ('+ price_label.trim() + ')');

		var div = $('<div></div>').append(html);
		table.after(div);
		table.hide();
	});
});
