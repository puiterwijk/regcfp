
$(function() {
	$( '.uls-trigger' ).uls( {
		onSelect : function( language ) {
			var languageName = $.uls.data.getAutonym( language );
			$( '.uls-trigger' ).text( languageName );
            $('#selectedLang').val(language);
            $('#langSelect').trigger('submit');
				},
		languages: { 'en' : 'English' , 'af': 'Afrikaans', 'ar': 'عربي', 'as': 'অসমীয়া', 'ast': 'Asturianu', 'bal': 'بلوچی', 'bg': 'български език', 'bn': 'বাংলা', 'bn_IN': 'বাংলা (ভারত)', 'br': 'Brezhoneg', 'ca': 'Català', 'cs': 'česky', 'da': 'dansk', 'de': 'Deutsch', 'de_CH': 'Schwyzerdütsch', 'el': 'Ελληνικά', 'en': 'English', 'en_GB': 'English (UK)', 'es': 'Español', 'eu': 'euskera', 'fa': 'پارسی', 'fi': 'suomi', 'fr': 'Français', 'gl': 'galego', 'gu': 'ગુજરાતી', 'he': 'עברית', 'hi': 'हिन्दी', 'hu': 'Magyar', 'ia': 'Interlingua', 'id': 'Indonesia', 'is': 'Íslenska', 'it': 'Italiano', 'ja': '日本語', 'ka': 'ქართული', 'kn': 'ಕನ್ನಡ', 'ko': '한국어', 'lv': 'latviešu', 'ml': 'മലയാളം', 'mr': 'मराठी', 'nb': 'Norsk bokmål', 'nl': 'Nederlands', 'or': 'ଓଡ଼ିଆ', 'pa': 'ਪੰਜਾਬੀ', 'pl': 'polski', 'pt': 'Português', 'pt_BR': 'Português brasileiro', 'ro': 'română', 'ru': 'Pусский', 'sk': 'slovenčina', 'sq': 'Shqip', 'sr': 'српски', 'sv': 'svenska', 'ta': 'தமிழ்', 'te': 'తెలుగు', 'tg': 'тоҷикӣ', 'th': 'ไทย', 'tr': 'Tϋrkçe', 'uk': 'українська', 'vi': 'Tiếng Việt', 'zh_CN': '简体中文', 'zh_TW': '正體中文'}
	} );
} );
