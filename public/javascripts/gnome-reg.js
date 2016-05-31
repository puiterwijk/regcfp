

$(function() {
	$( '#reg-fee' ).change( function() {
		amount =  parseFloat(this.value);
		$( '#reg-fee-slider' ).slider( "option", "value", amount );
		$( '.perk' ).each(function() {
			perk_amount = parseFloat($(this).attr('data-amount'));
			if (amount >= perk_amount) {
				$(this).addClass('perk-enough');
			} else {
				$(this).removeClass('perk-enough');
			}
		})
	} );

	$( '#reg-fee-slider' ).slider({
		value: $('#reg-fee').val(),
		min: 0,
		max: 250,
		step: 1,
		slide: function( event, ui ) {
			$( "#reg-fee" ).val( ui.value );
			$( "#reg-fee" ).change();
		}
	});

	$('#reg-fee').change();

	var bg_student = $('<div class="slider-bg slider-bg-student"><span>Student</span></div>');
	bg_student.css('width', 20.0 / 250.0 * 100 +'%');
	$('#reg-fee-slider').append(bg_student);

	var bg_normal = $('<div class="slider-bg slider-bg-casual"><span>Hobbyist</span></div>');
	bg_normal.css('width', (100 - 20) / 250.0 * 100 +'%');
	$('#reg-fee-slider').append(bg_normal);

	var bg_normal = $('<div class="slider-bg slider-bg-professional"><span>Professional</span></div>');
	bg_normal.css('width', (250 - 100) / 250.0 * 100 +'%');
	$('#reg-fee-slider').append(bg_normal);


	var tick_student = $('<div class="slider-tick"><span>15 €</span></div>');
	tick_student.css('width', 15.0 / 250.0 * 100 +'%');
	tick_student.find('span').mousedown(function (e) {$('#reg-fee').val(15); $('#reg-fee').change(); e.stopPropagation();});
	$('#reg-fee-slider').append(tick_student);

	var tick_casual = $('<div class="slider-tick"><span>40 €</span></div>');
	tick_casual.css('width', (40 - 15.0) / 250.0 * 100 +'%');
	tick_casual.find('span').mousedown(function (e) {$('#reg-fee').val(40); $('#reg-fee').change(); e.stopPropagation();});
	$('#reg-fee-slider').append(tick_casual);

	var tick_professional = $('<div class="slider-tick"><span>150 €</span></div>');
	tick_professional.css('width', (150 - 40.0) / 250.0 * 100 +'%');
	tick_professional.find('span').mousedown(function (e) {$('#reg-fee').val(150); $('#reg-fee').change(); e.stopPropagation();});
	$('#reg-fee-slider').append(tick_professional);

	/* Accomodation contact information hiding */
	$('#reg-roommate').change(function () {
		if (this.value == 'No') {
			$('#reg-contact').attr('disabled', true);
			$('#reg-contact').val('');
		} else {
			$('#reg-contact').attr('disabled', false);
			$('#reg-public').attr('checked', false);
		}
	});
	$('#reg-roommate').change();


} );


