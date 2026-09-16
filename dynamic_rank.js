(function(){
"use strict";

/* ENGLISH_IPHONE_LAYOUT_FIX_V2
   English-only runtime layout correction.
   The original ranking engine is loaded from the published project after
   the layout fix is installed. The published engine is byte-identical to
   the current english-version engine at preparation time.
*/
function installEnglishIPhoneLayoutFix(){
  if(document.getElementById("tenx-english-iphone-layout-fix-v2")) return;

  const style=document.createElement("style");
  style.id="tenx-english-iphone-layout-fix-v2";
  style.textContent=`
    html,body{
      width:100%!important;
      max-width:100%!important;
      overflow-x:hidden!important;
      -webkit-text-size-adjust:100%;
    }
    body,.app,.app *{box-sizing:border-box;min-width:0}
    .app{
      width:100%!important;
      max-width:820px!important;
      overflow-x:hidden!important;
    }

    /* Long English labels must never determine the page width. */
    #topRankingSection [style*="white-space:nowrap"],
    #marketInfoLinks [style*="white-space:nowrap"]{
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }

    .rankcard,.sectionbox,.formcard,.table,
    .marketrow,.termrow,.actionrow,.formgrid,.managegrid{
      width:100%;
      max-width:100%!important;
      min-width:0!important;
    }

    .trow{
      grid-template-columns:30px 52px minmax(0,1fr) 44px 32px 26px!important;
      gap:3px!important;
      padding-left:4px!important;
      padding-right:4px!important;
      font-size:10px!important;
    }
    .trow>*{min-width:0!important}
    .sname{
      min-width:0!important;
      max-width:100%!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    .score{font-size:14px!important}

    #marketInfoLinks > div[style*="grid-template-columns:repeat(4,1fr)"]{
      grid-template-columns:repeat(2,minmax(0,1fr))!important;
    }
    #marketInfoLinks a,
    #marketInfoLinks button{
      min-width:0!important;
      max-width:100%!important;
      white-space:normal!important;
      overflow-wrap:anywhere!important;
    }

    .marketbtn,.termbtn,.maincta,.managebtn,.action,.allbtn,.navbtn{
      min-width:0!important;
      max-width:100%!important;
      overflow-wrap:anywhere!important;
    }

    @media(max-width:520px){
      .app{
        padding-left:8px!important;
        padding-right:8px!important;
      }
      .header{
        padding-left:52px!important;
        padding-right:70px!important;
      }
      .logo{
        font-size:21px!important;
        white-space:nowrap!important;
      }
      .kicker{font-size:10px!important}
      .marketbtn{font-size:13px!important}
      .termbtn{font-size:11px!important}
      .termbtn small{font-size:7px!important}
      .rankhead{
        align-items:flex-start!important;
        gap:5px!important;
      }
      .rankhead h2{
        min-width:0!important;
        font-size:15px!important;
        line-height:1.25!important;
      }
      .allbtn{
        flex:0 0 auto!important;
        padding:6px 7px!important;
        font-size:8px!important;
      }
      .bottomnav .inner{
        grid-template-columns:repeat(5,minmax(0,1fr))!important;
      }
      .navbtn{
        padding-left:0!important;
        padding-right:0!important;
        font-size:7px!important;
        overflow:hidden!important;
      }
    }
  `;
  document.head.appendChild(style);
}

installEnglishIPhoneLayoutFix();

/* Keep the existing ranking function. main and english-version currently use
   the same dynamic_rank.js blob, so loading the published copy preserves it. */
const original=document.createElement("script");
original.src="https://shu39a-lang.github.io/10x-stock-project/dynamic_rank.js?v=62";
original.async=false;
original.onerror=function(){
  console.warn("Published dynamic ranking script could not be loaded.");
};
document.head.appendChild(original);

})();
