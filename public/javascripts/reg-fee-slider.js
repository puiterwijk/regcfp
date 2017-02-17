// registration-fee-slider: a visual control for the `reg-fee` field
//
// To use this in your registration form, you need to add this to your
// layouts/main.hbs template inside the <head> block:
//
//   <script type="text/javascript" src="/javascripts/reg-fee-slider.js"></script>
//
// Then you add the slider element near the reg-fee <input> element like this:
//
//   <div id="reg-fee-slider" ></div>


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
	bg_normal.css('width', (150 - 20) / 250.0 * 100 +'%');
	$('#reg-fee-slider').append(bg_normal);

	var bg_normal = $('<div class="slider-bg slider-bg-professional"><span>Professional</span></div>');
	bg_normal.css('width', (250 - 150) / 250.0 * 100 +'%');
	$('#reg-fee-slider').append(bg_normal);


	var tick_student = $('<div class="slider-tick"><span>15</span></div>');
	tick_student.css('width', 15.0 / 250.0 * 100 +'%');
	tick_student.find('span').mousedown(function (e) {$('#reg-fee').val(15); $('#reg-fee').change(); e.stopPropagation();});
	$('#reg-fee-slider').append(tick_student);

	var tick_casual = $('<div class="slider-tick"><span>40</span></div>');
	tick_casual.css('width', (40 - 15.0) / 250.0 * 100 +'%');
	tick_casual.find('span').mousedown(function (e) {$('#reg-fee').val(40); $('#reg-fee').change(); e.stopPropagation();});
	$('#reg-fee-slider').append(tick_casual);

	var tick_professional = $('<div class="slider-tick"><span>150</span></div>');
	tick_professional.css('width', (150 - 40.0) / 250.0 * 100 +'%');
	tick_professional.find('span').mousedown(function (e) {$('#reg-fee').val(150); $('#reg-fee').change(); e.stopPropagation();});
	$('#reg-fee-slider').append(tick_professional);
} );
