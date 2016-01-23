/*
 * jQuery Expander plugin
 * Version 0.4  (12/09/2008)
 * @requires jQuery v1.1.1+
 *
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 *
 */

(function($){$.fn.expander=function(options){var opts=$.extend({},$.fn.expander.defaults,options);var delayedCollapse;return this.each(function(){var $this=$(this);var o=$.meta?$.extend({},opts,$this.data()):opts;var cleanedTag,startTags,endTags;var allText=$this.html();var startText=allText.slice(0,o.slicePoint).replace(/\w+$/,'');startTags=startText.match(/<\w[^>]*>/g);if(startTags){startText=allText.slice(0,o.slicePoint+startTags.join('').length).replace(/\w+$/,'');}
if(startText.lastIndexOf('<')>startText.lastIndexOf('>')){startText=startText.slice(0,startText.lastIndexOf('<'));}
var endText=allText.slice(startText.length);if(!$('span.details',this).length){if(endText.replace(/\s+$/,'').split(' ').length<o.widow){return;}
if(endText.indexOf('</')>-1){endTags=endText.match(/<(\/)?[^>]*>/g);for(var i=0;i<endTags.length;i++){if(endTags[i].indexOf('</')>-1){var startTag,startTagExists=false;for(var j=0;j<i;j++){startTag=endTags[j].slice(0,endTags[j].indexOf(' ')).replace(/(\w)$/,'$1>');if(startTag==rSlash(endTags[i])){startTagExists=true;}}
if(!startTagExists){startText=startText+endTags[i];var matched=false;for(var s=startTags.length-1;s>=0;s--){if(startTags[s].slice(0,startTags[s].indexOf(' ')).replace(/(\w)$/,'$1>')==rSlash(endTags[i])&&matched==false){cleanedTag=cleanedTag?startTags[s]+cleanedTag:startTags[s];matched=true;}};}}}
endText=cleanedTag&&cleanedTag+endText||endText;}
$this.html([startText,'<span class="read-more">',o.expandPrefix,'<a href="#">',o.expandText,'</a>','</span>','<span class="details">',endText,'</span>'].join(''));}
var $thisDetails=$('span.details',this),$readMore=$('span.read-more',this);$thisDetails.hide();$readMore.find('a').click(function(){$readMore.hide();if(o.expandEffect==='show'&&!o.expandSpeed){o.beforeExpand($this);$thisDetails.show();o.afterExpand($this);delayCollapse(o,$thisDetails);}else{o.beforeExpand($this);$thisDetails[o.expandEffect](o.expandSpeed,function(){$thisDetails.css({zoom:''});o.afterExpand($this);delayCollapse(o,$thisDetails);});}
return false;});if(o.userCollapse){$this.find('span.details').append('<span class="re-collapse">'+o.userCollapsePrefix+'<a href="#">'+o.userCollapseText+'</a></span>');$this.find('span.re-collapse a').click(function(){clearTimeout(delayedCollapse);var $detailsCollapsed=$(this).parents('span.details');reCollapse($detailsCollapsed);o.onCollapse($this,true);return false;});}});function reCollapse(el){el.hide().prev('span.read-more').show();}
function delayCollapse(option,$collapseEl){if(option.collapseTimer){delayedCollapse=setTimeout(function(){reCollapse($collapseEl);option.onCollapse($collapseEl.parent(),false);},option.collapseTimer);}}
function rSlash(rString){return rString.replace(/\//,'');}};$.fn.expander.defaults={slicePoint:100,widow:4,expandText:'read more',expandPrefix:'&hellip; ',collapseTimer:0,expandEffect:'fadeIn',expandSpeed:'',userCollapse:true,userCollapseText:'[collapse expanded text]',userCollapsePrefix:' ',beforeExpand:function($thisEl){},afterExpand:function($thisEl){},onCollapse:function($thisEl,byUser){}};})(jQuery);
