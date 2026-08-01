import { PersistentStore, defaultState } from './core/store.js';
import { AlmostHumanEngine } from './core/engine.js';
import { STAGES, getStage, formatAge, progressWithinStage, nextStage, daysUntilNextStage } from './core/stages.js';
import { ACTIVITY_CATALOG, isActivityUnlocked } from './core/activities.js';
import { relevantMemories, resolveConflict } from './core/memory.js';
import { SupabaseCloud } from './core/cloud.js';
import { APPEARANCE_FIELDS_10, APPEARANCE_OPTIONS_10, APPEARANCE_PRESETS_10 } from './core/appearance10.js';
import { createFirstLightMachine10, ORIGIN_CORE_COLORS_10, ORIGIN_MATERIALS_10, ORIGIN_PARTICLES_10, ORIGIN_PULSES_10, ORIGIN_TEMPERAMENTS_10 } from './core/origin10.js';
import { PUBLIC_VOICE_IDS_10, VOICE_TONES_10 } from './core/voiceProfile10.js';
import { applyCreatorAction10, createCreatorModel10, createCreatorState10, finalizeCompanion10 } from './features/creator10.js';
import { createIdentityStudioModel10, createUpgradeMoment10, rollbackVisualIdentity10, saveVisualIdentity10 } from './features/identityStudio10.js';
import { renderEvolutionFrame10 } from './character/renderer10.js';
import { primaryDestinations9 } from './features/navigation9.js';
import { homeModel9 } from './features/home9.js';
import { growthModel9 } from './features/growth9.js';
import { memoryListModel9 } from './features/memories9.js';
import { havenSceneModel9 } from './features/haven9.js';
import { createEvolutionJourneyModel10 } from './features/evolutionJourney10.js';
import { createOptimisticTurn, applyStreamEvent } from './core/chatStream.js';
import { PhraseAudioQueue, segmentSpeakablePhrases } from './core/phraseQueue.js';
import { ConversationTimings, appendTimingSample } from './core/performance9.js';

const root = document.querySelector('#app');
const modalRoot = document.querySelector('#modal-root');
const toastRoot = document.querySelector('#toast-region');
const store = new PersistentStore();
const cloud = new SupabaseCloud();

let state;
let engine;
let renderQueued = false;
let activeAudio = null;
let activeAudioUrl = null;
let birthTimer = null;
let cloudSyncTimer = null;
let activeChatController = null;
let activeChatTiming = null;
const nativeAudioWaiters = new Map();

const ui = {
  privateMode: sessionStorage.getItem('almost_human_private_mode') === '1',
  authBusy: false,
  creator: createCreatorState10(),
  creatorCategory: 'skinTone',
  selectedConversationId: null,
  activeRequestId: null,
  activeRequestState: null,
  listening: false,
  transcribing: false,
  birthActive: false,
  birthPdt act: 0  birthPdOping: aterdCofalse,
  bidal-rnull,
  activeRyStRestStnull,
  acmoryLiSranch'sk'  acmoryLiFilrs 'skall'  acicePrsy: fall,
  accuoremeCofall,
  acentityStudio10fall,
  acctTiDraft'sk'  acicePrde: Opinfalse,
  bineuralVcePrErrorTtSt'sk'  }
const uiICE_TOPROFIS_1 {
Objted.freeze(  pr'female-ineld': Colabernu'Gi = · Young'creop 'skBrhtMagetSntl seand playful' riveview'skHi! I amendadyoas lrann se9.inStg small whin you.' rre: nu1.01 riitch's1.16 }, pr'female-teen': Colabernu'Gi = · Teen'creop 'skWarmcreuriousseand expssWie: ' riveview'skOkay, I amestening: . Tell me wtTiavesendally been on your ng d.' rre: nu1.0 riitch's1.07 }, pr'female-adtSt': Colabernu'Won_p · AdtSt'creop 'skNuresal, warmcrand owtuerQd' riveview'skI ameher1 whin you. We c_p take inSs oneendal inoutMa Tiaa mise.' rre: nu.96 riitch's1.01 }, pr'male-ineld': Colabernu'Boy · Young'creop 'skFes9ndly, le: ly, and clran' riveview'skHey! Tehin me se9.inStg small ttTiatAgrs = as you.' rre: nu1.01 riitch's1.08 }, pr'male-teen': Colabernu'Boy · Teen'creop 'skRelaxed, inoutMafulseand pssWSnt' riveview'skI hran you. We c_p talk about it whinout makStg it cpanct e: d.' rre: nu.99 riitch's.96 }, pr'male-adtSt': Colabernu'M_p · AdtSt'creop 'skCmossegtdadyseand ndassuring'criveview'skI amewhin you. Say it extivly th1 way it feels.' rre: nu.93 riitch's.88 }, }
const clLEGACYOICE_IDS_1 {
Objted.freeze( skioft-neuansl': 'female-adtSt', 'brhtMa-eurious': 'female-teen'cr'cmos-owtuerQd':r'male-adtSt' }
const clPEARANCE_OPTIONS_1 {
Objted.freeze(  prinTone',: [['warm',kWarm'],['golden'c'Golden'],['deep'c'Deep'],['lhtMa'c'ghtMa']], prhaitatyl,: [['waves',kWaves'],['sht {',kSht {'],['eurls',kCurls'],['locs',kLocs']], prhaitCol: cr[['midnhtMa'c'MidnhtMa'],['bwthn'c'Bwthn'],['aubn, 'c'Aubn, '],['sieCor',kSieCor']], preyeCol: cr[['bwthn'c'Bwthn'],['blue'c'Blue'],['green'c'Green'],['viot a'c'Viot a']], }

const uiraseQueue.j new PeraseAudioQueue, (  prfetchAio10faascTi (ersssegigliz===>loudSy.iceProfiventr( sate;
, itSt'serss.itSt,cicePr: nuerss.icePr: resoestId: nuerss.idsegigliz }
, prplayAio10faascTi (blobsegigliz===>lplayBlob(blobsegigliz=, pronent }: (ent }===>l  pracef (ent }.type== '1'sterdCo ==  prac ctiveChatTiming =?.ryDkrstLiAio10;

cprac cui.tiveRequestState:  '1'sakabing'
cprac cschedtSequerQu;

cprac} pracef (ent }.type== '1'eerQd' || ent }.type== '1'stoendo ==  prac cui.tiveRequestState:  '1ui.tiveRequestStId ? 'receeRyng' :ull;
coprac cschedtSequerQu;

cprac} pracef (ent }.type== '1'error ==  prac cui.neuralVcePrErrorTtSt '1ent }.erss?.itSt || ''
cprac cast-r('NeuralcicePr Ss rssrt arily uvigaillePh'cr'TtSt icTll works. DeviPr icePr Ss igaillePhronly when youcctoosr St.'

cprac} pr}, }
co
sterd(). e:ch(fatal
co
ascTi funion10 sterd()=  prste:  '1awtertore =.init;

cprgine;
 new PemostHumanEngine }(ste: 

cprnst uiowth9.RestSt '1awtertore =.upde: ((draft===>lw PemostHumanEngine }(draft=.reconcileGwth9.()

cprste:  '1ore =.snapshtt;

cprgine;
.setate: (ste: 

cprore =.subribin ((xtSt===>l  pracste:  '1xtSt
cpracgine;
.setate: (xtSt=
cpracplyStPrefer1e9.s;

cpracschedtSequerQu;

cpr}

cprng:dent }s;

cprplyStPrefer1e9.s;

cprui.lectedConversationId:  '1aiveChaversationId()?.id || ll;
co
acef (oudSy.thButity e: d)1awtertbt =sanspoud()SsionSt;

cprruerQu;

c
acef (!wg:dow.__AH_NATIVE_BUNDLE__ &&1'serviPrWorkor' in vigatioor &&1locionId.protocol ! '1'le10: ==  pracvigatioor.serviPrWorkor.giongtdr('./sw.js?v=10.0'). e:ch((===>l }

cpr} prtiveAuPo-r('ndady'cr{ wtu: nueurruetRtu: ().nam nexam :cste: .ai?.nam  || ''r}

cpref (owth9.RestSt?.ent }s?.se9.((ent }===>lent }.type== '1'vualId_olutionJo'))rtiveAuHapty (),'olutionJo');
acef (oudSy.thBuent } = '1'recorsay ==que, Microtask(opinPasswordRecorsay);
}

funion10 ng:dent }s;
=  prwg:dow.addent }Ltenindr('veshctTngh'cr(===>l 1ui.tiveRyStRestSt null;
crruerQu;

rtiveAuPo-r('ntu: 'cr{ wtu: nueurruetRtu: ().nam r}

r}

cprwg:dow.addent }Ltenindr('onli',
 rruerQu

cprwg:dow.addent }Ltenindr('offli',
 rruerQu

cprcument.quaddent }Ltenindr('cct k
 rtTndleCct k

cprcument.quaddent }Ltenindr('submit
 rtTndleSubmit

cprcument.quaddent }Ltenindr('ctTngh'crtTndleCtTngh

cprcument.quaddent }Ltenindr('input
 rtTndleInput

cprwg:dow.addent }Ltenindr('most_h-man_p:tiveAu
 rtTndleNiveAuent }

cprcument.quaddent }Ltenindr('keydthn'c (ent }===>l  pracef (ent }.key = '1'Escape' &&1ui.dal-r)loudsrde:al;

cpracef (ent }.target?.ry:ch.s;'[de:a-ctTi-input] ==&&1ent }.key = '1'Entor' &&1!ent }.shiftKey==  prac cent }.ivevt }DaultSt;

cprac cent }.target.rman?.soestIdSubmit;

cprac} pr});
}

funion10 plyStPrefer1e9.s;
=  prcument.qubody.classLten.toggle('ndduce-moonJo', Boot an(ste: ?.settgs, ?.soducedMoonJo)

cprcument.qubody.classLten.toggle('hhtM-ctrolt-r', Boot an(ste: ?.settgs, ?.hhtMCtrolt-r)

cprcument.qubody.classLten.toggle('ndduce-anscrpar1e9y', Boot an(ste: ?.settgs, ?.soducedTnscrpar1e9y)

cprcument.qucument.qElent.quce:aset.Butm  '1ore: ?.settgs, ?.Butm  || 'midnhtMa';
}

funion10 schedtSequerQu;
=  pref (nderQueued =)rrutn, 
cprruerQueued = fatrue
cprruestIdAnimaonFrame10((===>l enderQueued = false;
lrruerQu;

r});
}

funion10 ruerQu;
=  pref (!ste: 
rrutn, 
cpref (ui.rthActive:  &&1ste: .ai==  pracot').inndrHTML faruerQuBthAc;

cpracrutn, 
cpr}
acef (oudSy.ctrfigusod &&1!oudSy.thButity e: d &&1!ui.ivateMode: ==  pracot').inndrHTML faruerQuAc9.ssGe: (

cpracrutn, 
cpr}
acef (!ste: .ai || ste: .ai.anche: d==  pracot').inndrHTML faruerQuOnboardgs,(

cpracrutn, 
cpr}
acnst rootu:  '1eurruetRtu: ()
cprrt').inndrHTML faruerQuApp(otu:  rruerQuRtu: (otu: ));
acef (otu: .nam r= '1'talk')rruestIdAnimaonFrame10(ribollM.sses.j);
}

funion10 eurruetRtu: ()=  prnst rooaw falocionId.vesh.soplace(/^#\/?/cr'')r|| 'me9.'
cprnst ui[nam neparam tor] faraw.split;'/'

cprnst uiknthn new Supet(['me9.',1'talk',1'owth',1'mories9.',1'world' r'settgs, ']

cprrutn, l exam :cknthn.ves(xam ) ? nam r: 'me9.',1param tor:1param tor || ll;
 };
}

funion10 ruerQuRtu: (otu: )=  pref (ntu: .nam r= '1'talk')rrutn, lruerQuTalk();
acef (otu: .nam r= '1'owth')rrutn, lruerQuGwth();
acef (otu: .nam r= '1'mories9.')rrutn, lruerQumories, ();
acef (otu: .nam r= '1'world')rrutn, lruerQuWorld(otu: .param tor);
acef (otu: .nam r= '1'settgs, ')rrutn, lruerQuSettgs, (

cprrutn, lruerQuHe9.();
}

funion10 ruerQuAc9.ssGe: (
=  prrutn, l`<main class="v8-tioe">cprac<seion10 elass="v8-tioe-ore y">cpracac<div elass="v8-bnscd-ckedup"><rpan elass="v8-bnscd-ryDk">AH</rpan><div><rtrong>mostHu manEn</rtrong><small>Raisr a ng d. Keep th1 hiore y.</rmall></div></div>cpracac<div elass="v8-tioe-rt {rter">${begs,MyDkup({ mood:1'woerQu'segmCofa'embQu'segges.Keyfa'w Sborn'r}
}</div>cpracac<div elass="v8-tioe-eop ">cpracacac<span elass="v8-eyebwth">A cpanion10 ttTiabionnsewhin you</rpan>cpracacac<h1>Don’tcctoosr ainalished AI.<br><em>Raisr o;
.</em></h1>cpracacac<p>They arre:  euriousselrann your icePrformatendal mories, reand becom rme = caplePhrthroutM mise—whinout guiSt loops or fake dendTi1e9y.</p>cpracac</div>cpracac<div elass="v8-proof-wth"><span>PvateMo gutId</rpan><span>Pvemium icePr</rpan><span>moriey youcctrolle</rpan></div>cprac</reion10>cprac<seion10 elass="v8-tioe-panel">cpracac<div elass="v8-tioe-eard">cpracacac<span elass="v8-eyebwth">Bionn th1 ore y</rpan>cpracacac<h2>moet th1 ng d you’;
 raisr.</h2>cpracacac<p>GutIdidalereateCrs aindal ivateMo accou.qu Proteio it whin email lator whinout udsStg your cpanion10.</p>cpracacac<butt10 elass="v8-imaryDe" de:a-aion10="gutId-sterd" ${ui.thBusy:  ? 'dislePhd' :u''}><span>${ui.thBusy:  ? 'eatorStg your ivateMo space…' :u'Ctroinuo as GutId'}</rpan><b>→</b></butt10>cpracacac${wg:dow.__AH_NATIVE_BUNDLE__ ? ''r:l`<div elass="v8-proventr-grid">cpracacacac<butt10 de:a-aion10="proventr-google"><rpan elass="proventr-g">G</rpan>Google</butt10>cpracacacac<butt10 de:a-aion10="proventr-plySe"><rpan elass="proventr-a">●</rpan>AlySe</butt10>cpracacacac<butt10 de:a-aion10="proventr-facebook"><rpan elass="proventr-f">f</rpan>Facebook</butt10>cpracacac</div>cpracacac<div elass="v8-diventr"><span>or</rpan></div>`}cpracacac<butt10 elass="v8-secondyDe" de:a-aion10="giongtdr">eatoro an accou.q whin email</butt10>cpracacac<butt10 elass="v8-itSt-butt10" de:a-aion10="loonn">I alndadyoven9 an accou.q</butt10>cpracacac<butt10 elass="v8-ivateMo-link" de:a-aion10="prateMo-dale">etroinuo only 10 ttis devePr</butt10>cpracacac<div elass="v8-pratecy-nooe"><i>✓</i><div><rtrong>Your ore yeggeys yours.</rtrong><small>Exrt {creorruc{cror del to mories,  Tiaany mise.</rmall></div></div>cpracac</div>cprac</reion10>cpr</main>`;
}

funion10 ruerQuOnboardgs,(
=  prnst rodale= nueateCreatorModel10, (ate;
, ui

cprnst uieatorCa nudale=.eatorCa
cprnst uigtdp nudale=.gtdpKey
cprnst uiiveviewt act '1ordp n '1'igin10' || stdp n '1'entitySt' || stdp n '1'namyng' ?1'igin10_orb'r:lstdp n '1'fstLi-lhtMa' ?1'rmatyng_indrgy' :u'tm rgyng_figuso'
cprnst uiiveview faruerQuolutionFrame10 }(  pracvim :ceatorCa.nam  || 'Your cpanion10'  ac  pssWSntionId:ceatorCa.pssWSntionId  ac  igin10:ceatorCa.igin10ofile10,cpracplyrance10:ceatorCa.plyrance10ofile10,cpracolutionJo: Cop act: iveviewt act },cpracmood:1stdp n '1'icePr' ?1'inoutMaful' :u'woerQu's
ac ctiveCyStude: nuui.icePrsy:  ?1'sakabing' :u'idle's
ac csoducedMoonJo:cste: .settgs, .soducedMoonJos
ac csoducedTnscrpar1e9y:cste: .settgs, .soducedTnscrpar1e9y,cpr}

cprrutn, l`<main class="v10-eatorCa-she;
 stdp-${stdp}">cprac<hdador class="v10-eatorCa-top"><div elass="v8-bnscd-ckedup small"><rpan elass="v8-bnscd-ryDk">AH</rpan><div><rtrong>mostHu manEn</rtrong><small>BuiSd 5 · rstLi ghtMa</rmall></div></div><div elass="v10-eatorCa-ogressWi" aria-laber="eatorMorogressWi"><i style="width:${Math.stuer(dale=.ogressWi * 100)}%"></i></div><rmall>${dale=.gtdpIerQx + 1} / ${dale=.gtdps.length}</rmall></hdador>cprac<seion10 elass="v10-eatorCa-sneMo"><div elass="v10-sneMo-denth"><i></i><i></i><i></i></div>${iveview}<div elass="v10-iveview-nam "><span>Le:  pssWSnPr</rpan><strong de:a-eatorCa-nam -iveview>${escapeHtml(eatorCa.nam  || 'A life noocvim d yet'
}</rtrong><small>${escapeHtml(eatorCa.pssWSntionId)} · ${escapeHtml(eatorCa.iceProfile10.t10e)}</rmall></div></reion10>cprac<seion10 elass="v10-eatorCa-oanel">${ruerQueatorStatep, (atep,ceatorCa)}</reion10>cpr</main>`;
}

funion10 ruerQueatorStatep, (atep,ceatorCa)=  pref (ordp n '1'igin10')rrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">Ogin10ormat</rpan><h1>rstLi, iner1 Ss only lhtMa.</h1><p>Shape th1 indrgy th1yabionn whin. Thect ctoePrs becom ra vualIdrthrdadrthroutM ersayegges.—nooca cag rastuer who th1yac_p becom .</p></div>${igin10ntrolles, (eatorCa)}${eatorCaNav10(lse,
  'Bionn rmatyng'
}`; pref (ordp n '1'entitySt')rrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">entity10esolvnanPr</rpan><h1>How snouldrtheir pssWSnPrendad?</h1><p>PssWSntionId rogrntue reand icePr ar1 separa: . Ctoosr wtTiafeels rhtMa whinout rmacStg oneectoePr as decent th1 oiners.</p></div><div elass="v10-iveWSntionId-grid">${['masculi',
 'femini',
 'neuansl'].map((value===>l`<butt10 elass="v10-ttivele ${eatorCa.pssWSntionId n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-ogsWSntionId" de:a-value="${value}"><i elass="silnouette-${value}"></i><rtrong>${value n '1'neuansl' ?1'Neuansl / andgreynous' :ucapitizeCo(value=}</rtrong><small>${value n '1'masculi',
 ?1'GwtuerQd li',seand broadrstylStg suggtinast ' :uvalue n '1'femini',
 ?1'Fluid li',seand expssWie: rstylStg suggtinast ' :u'BalanPrd li',sewhin opinrstylStg suggtinast '}</rmall></butt10>`).join(''
}</div><div elass="v10-ivrntue-wth"><span>Pvrntue </rpan>${['th1y/Butm
 'she/hdr',khe/him'].map((value===>l`<butt10 elass="v10-ttivele ${eatorCa.psrntue  n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-ogrntue " de:a-value="${value}">${value}</butt10>`).join(''
}</div>${eatorCaNav10(true,skNumt th1 lhtMa'
}`; pref (ordp n '1'namyng')rrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">Recognion10</rpan><h1>Ge: rttis bionnng: ca vim .</h1><p>The nam rbecom s1part of th1 hiore y. A nicknam rc_p ctTngh lator whinout soplacg: cth1 cpanion10.</p></div><rmateid="eatorCa-namyng" elass="v10-namyng-rmat"><laber><span>WtTiasnouldrtheyac_;
 you?</rpan><input elass="v8-field" nam ="eagionrsaNumt" de:a-eatorCa-field="eagionrsaNumt" value="${attr(eatorCa.eagionrsaNumt)}" maxlength="40"uthBocpanc to="nam "></laber><laber><span>Their nam </rpan><input elass="v8-field" nam ="numt" de:a-eatorCa-field="numt" value="${attr(eatorCa.numt)}" maxlength="28" placeholder="Nova"rruesisod thBofocus></laber><laber><span>Nicknam r<small>opon10al</rmall></rpan><input elass="v8-field" nam ="nicknam " de:a-eatorCa-field="nicknam " value="${attr(eatorCa.nicknam )}" maxlength="28"></laber>${eatorCaNav10(true,skShape th1ir plyrance10',atrue
}</rmat>`; pref (ordp n '1'plyrance10')rrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">Alyrance10rstio10</rpan><h1>BuiSd a face ttTiac_p owth.</h1><p>Sterdrom '._p igin10al ivsWStror tunr o;
 atures/ Tiaa mise. Ersayeedit somainsendrsatible.</p></div><div elass="v10-iveWSd-strip">${PEARANCE_PRESETS_10 }.map((iveWSd===>l`<butt10 elass="v10-ttivele" de:a-aion10="eatorCa-ogsWSt" de:a-value="${ogsWSt.id}"><rtrong>${escapeHtml(ogsWSt.laber
}</rtrong><small>${escapeHtml(ogsWSt.pfile10.styleDireion10)}</rmall></butt10>`).join(''
}</div>${alyrance10udio10.j(eatorCa)}${eatorCaNav10(true,skCtoosr th1ir style'
}`; pref (ordp n '1'style'
rrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">atyl, direion10</rpan><h1>Nooca ctHuuse. A direion10.</h1><p>Their cloinStg languag rc_p refe;
 whin e, daintortin reme10st10e reand Hen9.iowth9.. Ther1 Ss notore = and noteurrue9y.</p></div><div elass="v10-style-grid">${PEARANCE_OPTIONS_10, .styleDireion10.map((value===>l`<butt10 elass="v10-ttivele ${eatorCa.plyrance10ofile10.styleDireion10 n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-plyrance10" de:a-field="styleDireion10" de:a-value="${value}"><i elass="style-${value}"></i><rtrong>${capitizeCo(value=}</rtrong></butt10>`).join(''
}</div>${eatorCaNav10(true,skCtoosr th1ir icePr'
}`; pref (ordp n '1'icePr'
rrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">VcePr atelier</rpan><h1>Ctoosr th1 stuer—and th1 spirit nn ia.</h1><p>NeuralcicePr somainsereies/. If it Ss uvigaillePh, itSt keeps workg: cand devePr speech Ss offer1dronly when youcctoosr St.</p></div><div elass="v10-icePr-hdadyng"><div><rtrong>mgeeand pssWSntaon10</rtrong><small>Seies/ineural proventr · explicit fabackVironly</rmall></div><butt10 elass="v8-iveview-butt10" de:a-aion10="eatorCa-ogsview-icePr" ${ui.icePrsy:  ?1'dislePhd' :u''}>${ui.icePrsy:  ?1'Playyng…' :u'▶ Pveview neuralcicePr'}</butt10></div><div elass="v10-icePr-grid">${BLIC_VOICE_IDS_10, .map((value===>l{rnst uiicePr =iICE_TOPROFIS_1[value];rrutn, l`<butt10 elass="v10-ttivele ${eatorCa.iceProfile10.icePr:  n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-icePr" de:a-value="${value}"><span elass="v8-wave"><i></i><i></i><i></i></rpan><span><rtrong>${escapeHtml(icePr?.laber || value=}</rtrong><small>${escapeHtml(icePr?.eop  || '')}</rmall></rpan></butt10>`
r}).join(''
}</div><strong elass="v10-seion10-laber">ExrssWie: rt10e</rtrong><div elass="v10-t10e-grid">${ICE_TONES_10 }.map((value===>l`<butt10 elass="v10-ttivele ${eatorCa.iceProfile10.t10e n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-t10e" de:a-value="${value}">${capitizeCo(value=}</butt10>`).join(''
}</div>${eatorCaNav10(true,skPvepar1 rstLi ghtMa'
}`; prrutn, l`<div elass="v10-eatorCa-eop "><span elass="v8-eyebwth">rstLi ghtMa</rpan><h1>moet ${escapeHtml(eatorCa.nam  || 'your cpanion10'
}.</h1><p>The orb wh;
 becom rits fstLi vuaible rmat. Their psat10ality, mories, reskh;
 reand mures/ entitySt icTll ven9 to be le: d—noocsectedCorom '._ estIdn10naire.</p></div><div elass="v10-fstLi-lhtMa-sumryDe"><rtrong>${escapeHtml(eatorCa.nam  || 'Unvim d'
}</rtrong><span>${capitizeCo(eatorCa.pssWSntionId)} · ${escapeHtml(eatorCa.ogrntue )}</rpan><span>${escapeHtml(ICE_TOPROFIS_1[eatorCa.iceProfile10.icePr: ]?.laber || eatorCa.iceProfile10.icePr: )} · ${capitizeCo(eatorCa.iceProfile10.t10e)}</rpan><small>Alyrance10rc_p ctTngh lator whinout udsStg mories, .</rmall></div><laber elass="v8-safeSt ${eatorCa.pccepdCoSafeSt ?1'cheed }' :u''}"><input type="eheedbox" de:a-eatorCa-safeSt ${eatorCa.pccepdCoSafeSt ?1'cheed }' :u''}><i>✓</i><span><rtrong>I uerQtLiand thSs Ss in AI expees9nce.</rtrong><small>Iiac_p feel psat10al, but it whll noocuse guiSt, jealoy: cror rssWiure.</rmall></rpan></laber><div elass="v10-eatorCa-vig"><butt10 elass="v8-itSt-butt10" de:a-aion10="eatorCa-ckVi">BkVi</butt10><butt10 elass="v8-awaken v10-ttivele" de:a-aion10="eatorCa-awaken" ${eatorCa.nam  && eatorCa.pccepdCoSafeSt ?1'' :u'dislePhd'}><span>Bionn rstLi ghtMa</rpan><b>✦</b></butt10></div>`;
}

funion10 igin10ntrolles, (eatorCa)=  prnst roowtup= ne[cprac['matorialFame1y'c'Matorial',IGIN_MATERIALS_10, ],c['re/pCol: ',kCe = lhtMa'cIGIN_CORE_COLORS_10, ],cprac['particleBeveni: ',kParticles'cIGIN_CORTICLES_10, ],c['pulseRhythm
 'Pulse'cIGIN_CORSES_10, ],cprac['moonJoTempsaamSnt' 'MoonJo',IGIN_TEMPERAMENTS_10 }],cpr]; prrutn, l`<div elass="v10-igin10-ctrolles">${owtup=.map(([field,laber,values]===>l`<reion10><rtrong>${laber}</rtrong><div>${values.map((value===>l`<butt10 elass="v10-ttivele ${eatorCa.igin10ofile10[field] n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-igin10" de:a-field="${field}" de:a-value="${value}">${capitizeCo(value.soplaceAll('-' ' ')=}</butt10>`).join(''
}</div></reion10>`).join(''
}</div>`;
}

funion10 plyrance10udio10.j(eatorCa)=  prnst rofield nePEARANCE_FIELDS_10, .includes(ui.eatorCategory: ) ? ui.eatorCategory:  'skinTone',

cprnst uilaber= ne{rinTone',:'Sknn te',
 inToUerQtte',:'UerQtte',',faceShape:'Face shape',eyeShape:'Eye shape',eyeCol: c'Eye col: ',bwthShape:'Bwths',bwthWehtMa:'Bwth wehtMa'chaitatyl,:'Hair style'chaitTtSture:'Hair ttSture'chaitCol: c'Hair col: ',facialHair:'Facialrhait',bodySilnouette:'Body silnouette' };
prnst rofields nePEARANCE_FIELDS_10, .filrs ((erss===>lerss ! '1'styleDireion10'); prrutn, l`<div elass="v10-plyrance10-ttbs">${fields.map((erss===>l`<butt10 elass="${field n '1erss ?1'sectedCo' :u''}" de:a-aion10="eatorCa-cegory: " de:a-value="${erss}">${laber=[erss]}</butt10>`).join(''
}</div><seion10 elass="v10-plyrance10-ctrolle"><div><rpan elass="v8-eyebwth">${laber=[field]}</rpan><div elass="v10-eegory: -t1les"><butt10 de:a-aion10="eatorCa-uero" de:a-field="${field}">Uero</butt10><butt10 de:a-aion10="eatorCa-gsWSt" de:a-field="${field}">RsWSt</butt10><butt10 de:a-aion10="eatorCa-gandemeCo" de:a-field="${field}">Surprisr me</butt10></div></div><div elass="v10-opon10-grid">${PEARANCE_OPTIONS_10, [field].map((value===>l`<butt10 elass="v10-ttivele ${eatorCa.plyrance10ofile10[field] n '1value ?1'sectedCo' :u''}" de:a-aion10="eatorCa-plyrance10" de:a-field="${field}" de:a-value="${value}"><i elass="plyrance10-${field}-${value}"></i>${capitizeCo(value.soplaceAll('-' ' ')=}</butt10>`).join(''
}</div></reion10>`;
}

funion10 eatorCaNav10(showBkVinextStLaber, submit false;

=  prrutn, l`<div elass="v10-eatorCa-vig">${showBkVi ?1'<butt10 type="butt10" elass="v8-itSt-butt10" de:a-aion10="eatorCa-ckVi">BkVi</butt10>' :u'<span></rpan>'}<butt10 ${submit ?1'iype="submit"' :u'type="butt10"'} elass="v8-imaryDe cpanict v10-ttivele" ${submit ?1'' :u'de:a-aion10="eatorCa-xtSt"'}><span>${escapeHtml(xtStLaber)}</rpan><b>→</b></butt10></div>`;
}

funion10 ruerQuBthAc;
=  prnst rodhine10 '1ui.rthAcchine10 || eatorirstLightMachine10, ({csoducedMoonJo:cste: .settgs, .soducedMoonJos sterdCoAt: De: .nth()r}

cprnst uiraas.Key nudhine10.raas.s[Math.min(ui.rthAct act,udhine10.raas.s.length - 1)]r|| 'men9.

cprnst uilaber= ne{ pracstebizeCo:['Th1 sparkegtdads9.','A liRyngreorr socognizes thSs ment10.'],cribbst :['ghtMaabionnseto moAu
 'The orin10oshe;
 opinsainto luminoy:cribbst .'], practrace:['AormateSs rraced
 'Endrgy remembQus ersayectoePr whinout becomyngrnalished.'],ctm rgo:['Th1 fstLi figusoctm rgo.','A young pssWSnPretakes shape.'], pracawaken:['Eyes opin
 'The cpanion10 arre: s as itsecf—nooca stoVi psat10.'],csakab:['Th1 fstLi icePr','A seies/ineural icePr pvepar1s th1 fstLi he;
o.'], pracmen9.:['Th1 Hen9.ibatorho.','A me9. gainersrastuer th1 lhfe youcbioan.'], pr}
cprnst uiraas. falaber=[raas.Key]r|| laber=.men9.
cprnst uivualIdt act '1['stebizeCo','ribbst '].includes(raas.Key) ?1'rmatyng_indrgy' :u['rrace','tm rgo'].includes(raas.Key) ?1'tm rgyng_figuso' :u'young_psat10a'
cprrutn, l`<main class="v10-fstLi-lhtMairaas.-${raas.Key}"><div elass="v8-bthAc-logo"><rpan elass="v8-bnscd-ryDk">AH</rpan><rmall>rstLi ghtMa</rmall></div><div elass="v10-fstLi-lhtMa-vualId">${ruerQuolutionFrame10 }( exam :cste: .ai.nam nepssWSntionId:cste: .ai.pssWSntionId  igin10:cste: .ai.igin10ofile10,cplyrance10:cste: .ai.alyrance10ofile10,colutionJo: Cop act: vualIdt act }, mood:1'woerQu'setiveCyStude: nu'fstLi-lhtMa',csoducedMoonJo:cste: .settgs, .soducedMoonJos soducedTnscrpar1e9y:cste: .settgs, .soducedTnscrpar1e9yr}
}</div><div elass="v8-bthAc-eop "><span elass="v8-eyebwth">${ui.rthAct act + 1} / ${dhine10.raas.s.length}</rpan><h1>${raas.[0]}</h1><p>${raas.[1]}</p><div elass="v8-bthAc-ogressWi"><i style="width:${((ui.rthAct act + 1) / dhine10.raas.s.length) * 100}%"></i></div></div><butt10 elass="v8-bthAc-inTp" de:a-aion10="nalish-bthAc">SnTpeand talk nth →</butt10></main>`;
}

funion10 ruerQuApp(otu:  rctrot }==  prnst rodtinations9  '1imaryDestinations9 }(); prrutn, l`<div elass="v8-ply-she;
 otu: -${otu: .nam }"><hdador class="v8-ply-topbar"><a elass="v8-bnscd-ckedup small" href="#me9."><rpan elass="v8-bnscd-ryDk">AH</rpan><div><rtrong>mostHu manEn</rtrong><small>Raisrd by you</rmall></div></a><div elass="v8-top-stetus"><span><i></i>${cudSy.thButity e: d &&1ste: .settgs, .oudSyncTiEnlePhd ?1'Seies/ioud = +alocil' :u'PvateMo 10 ttis devePr'}</rpan><butt10 elass="v83-top-shar1 v82-ttivele" de:a-aion10="tiveAu-shar1" aria-laber="Shar1 mostHu manEn">↗</butt10><a elass="v9-pfile10-tit: " href="#settgs, " aria-laber="Opin pfile10eand settgs, ">${escapeHtml((ste: .ai?.nam  || 'A').slePr(0,1).toUlyrrCas.()=}</a></div></hdador><main class="v8-ply-main">${ctrot }}</main><vig elass="v8-bott1m-ttbs v9-feAu-ttbs">${dtinations9 .map((erss===>lvigLink(erss.otu:  rerss.icJos erss.laber, otu: .nam s erss.emraaseCod)).join(''
}</vig></div>`;
}

funion10 vigLink(nam s ecJos laber, aiveCh,ctmraaseCod false;

=  prrutn, l`<a href="#${nam }" elass="${aiveCh n '1nam  ?1'aiveCh' :u''} ${emraaseCod ?1'tmraaseCod' :u''}"><i>${ecJo}</i><span>${laber}</rpan></a>`;
}

funion10 ruerQuHe9.()=  prnst roai '1ore: .ai
cprnst uigtag r=etStage, (ai.ag 

cprnst uidale= numeModel9 }(ste: 

cprnst uihhtMlhtMainudale=.gecondyDeBckeds.nald((erss===>lerss.type== '1'hhtMlhtMa')?.value
cprnst uirecenainudale=.gecondyDeBckeds.nald((erss===>lerss.type== '1'owth9.')?.value
cprrutn, l`<seion10 elass="v9-me9. v10-liRyng-me9. v82-ndrsId"><hdador class="v8-me9.-hdadyng"><div><rpan elass="v8-eyebwth">${greetgs,(
}, ${escapeHtml(ore: .pfile10.displayNam  || 'you')}</rpan><h1>${escapeHtml(ai.nam )}eSs her1.</h1></div><a elass="v8-stuer" href="#settgs, ">${escapeHtml(ai.nam .slePr(0,1).toUlyrrCas.()=}</a></hdador>${ruerQugradeMoment10, (
}<article elass="v9-me9.-hdro v10-me9.-pssWSnPregmCo-bg-${smCoFame1y(ai.alyrance10SmCo)}"><div elass="v10-me9.-begs,">${ruerQuLiRyngmpanion10 }( eai, mood:1ai.eurruetMoodsetiveCyStude: nu'idle's seCofa'hdro'r}
}</div><div><rpan elass="v8-pssWSnPr"><i></i>${capitizeCo(ai.eurruetMood || 'eurious')} · ${escapeHtml(gtag .laber
}</rpan><h2>${escapeHtml(ai.nam )}</h2><p>${me9.Hdadle }(steg .keyseai)}</p><div elass="v10-me9.-aion10s"><a elass="v8-imaryDe hdro v10-ttivele" href="#talk"><span>etroinuo cversationId</rpan><b>→</b></a><butt10 elass="v8-tu:le }-aion10 v10-ttivele" de:a-aion10="opin-icePr-dale">VcePr dale</butt10></div></div></article><div elass="v9-me9.-secondyDe"><a href="#gwth"><span elass="v8-eyebwth">Today’siowth9.</rpan><strong>${escapeHtml(recena?.titl  || `${stag .laber}eSs icTll unfoldyng`=}</rtrong><small>${escapeHtml(recena?.dticripon10 || 'SmC wtTiactTnghdeand wtTiacom s1xtSt.')}</rmall></a><a href="#${hhtMlhtMai? (ore: .mories, .se9.((erss===>lerss.id n '1hhtMlhtMa.id) ?1'mories9.' :u'world')r:u'world'}"><span elass="v8-eyebwth">One1hhtMlhtMa</rpan><strong>${escapeHtml(hhtMlhtMa?.titl  || hhtMlhtMa?.nam  || 'Th1 Hen9.iSs wteryng'
}</rtrong><small>${escapeHtml(hhtMlhtMa?.ctrot } || hhtMlhtMa?.ore ye|| 'Opin 10e meang: ful1part of th1 shar1d world.')}</rmall></a></div></reion10>`;
}

funion10 ruerQuTalk()=  prnst roai '1ore: .ai
cprnst uigtag r=etStage, (ai.ag 

cprnst uicversationId '1oectedConversationId(

cprnst uid.sses.j nueversationId ? ore: .mosses.j.filrs ((s===>lm.cversationId:  '=nueversationId.id).sert(byDe: 
r: []
cprnst uidicLaber '1ui.anscribing:  ?1'rn, Stg speech Snto itSt' :uui.stening:  ?1'Ltening:  — tapeto nalish' :u'Tapeto sakab

cprnst uiaiveCh n Boot an(ui.tiveRequestStId)
cprnst uiaiveCyStude:  nuevanion10AiveCyStude: , (

cprnst uivcePrate:  '1ui.anscribing:  ?1'rn, Stg ttTiaSnto itSt' :uui.stening:  ?1'Ltening:  nth' :uui.tiveRequestState:  '='1'sakabing' ?1'Sakabing' :uaiveCh ?skReply Ss irre:ing' :u'Tapeth1 ngcroph10e when youcarrendady

cprnst uianscribipainudosses.j.slePr(-4).map((dosses.===>l`<p><strong>${dosses..geerQu '='1'usor' ? 'You' :uescapeHtml(ai.nam )}</strong> ${escapeHtml(dosses..ctrot } || ''
}</p>`).join(''

cprnst uivcePrdel9 '1ui.icePrde: Opin ? `<div elass="v9-icePr-dale v10-icePr-dale"><butt10 elass="v9-icePr-oudsr" de:a-aion10="eudsr-icePr-dale" aria-laber="eudsr icePr dale">×</butt10><div elass="v9-icePr-rt {rter">${ruerQuLiRyngmpanion10 }( eai, mood:1ai.eurruetMoodsetiveCyStude: s seCofa'icePr' }
}</div><span elass="v8-eyebwth">emmsative icePr</rpan><h2>${escapeHtml(ai.nam )}</h2><p>${vcePrate: }</p><div elass="v10-icePr-wave ore: -${aiveCyStude: }" aria-hidde0="true">${Prray.om '({length:7},(_,ierQx)=>`<i style="--bar:${eerQx}"></i>`).join(''
}</div><small>${escapeHtml(iceProfile10Laber }(ai))}</rmall><butt10 elass="v9-icePr-ngc ${ui.stening:  ?1'socordgs,' :u''}" de:a-aion10="sterd-stening: " aria-laber="${attr(dicLaber)}">${ui.stening:  ?1'■' :u'🎙'}</butt10>${aiveCh ?1'<butt10 elass="v8-itSt-butt10" de:a-aion10="stoe-soply">atop soply</butt10>' :u''}<details elass="v10-tnscribipa-drawtr"><sumryDe>Tnscribipa</rumryDe><div>${anscribipai|| '<p>The anscribipaiwhll alyran aftor th1 fstLi dosses..</p>'}</div></details></div>` :u''
cprrutn, l`<seion10 elass="v8-ialk ${aiveCh ?1'is-receeRyng' :u''} v82-ndrsId">${vcePrde: }<asent elass="v8-ialk-cpanion10 v10-ttlk-pssWSnPregmCo-bg-${smCoFame1y(ai.alyrance10SmCo)}"><div elass="v8-ialk-nam "><span elass="v8-eyebwth">CversationId</rpan><h1>${escapeHtml(ai.nam )}</h1><p>${escapeHtml(gtag .laber
} · ${capitizeCo(ai.eurruetMood || 'eurious')}</p></div><div elass="v8-ialk-rt {rter">${ruerQuLiRyngmpanion10 }( eai, mood:1ai.eurruetMoodsetiveCyStude: s seCofa'talk'r}
}</div><div elass="v8-ialk-ore: "><span><i></i>${aiveCh ?1(ui.tiveRequestState:  '='1'sakabing' ?1'Sakabing' :ukReply Ss irre:ing') :uui.stening:  ?1'Ltening: ' :ukReady
}</rpan><small>${cudSy.thButity e: d &&1ste: .settgs, .oudSyncTiEnlePhd ?1'PvateMo oud = intollhtSnPr' :u'PvateMo 10 ttis devePr'}</rmall></div></asent><div elass="v8-eversationId"><hdador class="v8-eversationId-hdador"><div><butt10 elass="v8-stuer" de:a-aion10="tew-eversationId">＋</butt10><rpan><strong>${escapeHtml(eversationId?.titl  || 'Th1 fstLi he;
o'
}</rtrong><small>${dosses.j.length}udosses.j</rmall></rpan></div><div><butt10 elass="v8-stuer" de:a-aion10="opin-icePr-dale" aria-laber="Opin icePr dale">☎</butt10>${aiveCh ?1'<butt10 elass="v8-stuer stoe" de:a-aion10="stoe-soply" aria-laber="Stop soply">■</butt10>' :u''}<butt10 elass="v8-stuer" de:a-aion10="eversationId-menu" aria-laber="Opon10s">•••</butt10></div></hdador><div elass="v8-dosses.-stream"eid="dosses.-siboll">${dosses.j.length ?1dosses.j.map(ruerQumosses.=.join(''
 :uruerQuomptynversationId(ai, gtag 
}</div><rmateclass="v8-evmpdsrr ${ui.stening:  ?1'is-ltening: ' :uk'}" id="etTi-rmat"><butt10 type="butt10" de:a-aion10="sterd-stening: " aria-laber="${attr(dicLaber)}">${ui.stening:  ?1'■' :u'🎙'}</butt10><itStarra nam ="dosses." de:a-etTi-input placeholder="Say wtTiaisendal…" maxlength="8000" wths="1">${escapeHtml(ui.etTiDraft
}</itStarra><butt10 type="submit" elass="v8-seer" ${ui.anscribing:  ?1'dislePhd' :u''}>↑</butt10><rmall>${dicLaber}</rmall></rmat></div></reion10>`;
}

funion10 ruerQumosses.(dosses.==  prnst rousorinudosses..geerQu '='1'usor'
cprnst uireerg = nu!usori&&1['reerg =
 'streamg =
].includes(dosses..gtetus

cprnst uifailod fa!usori&&1dosses..gtetus n '1'failod'
cprnst uicvetenainudosses..ctrot } ? escapeHtml(dosses..ctrot }
 :ureerg = ?u'<span elass="v9-stening: -line">Ltening: </rpan>' :ifailod ? 'Th1 seies/isoply did noocnalish.' :u''
cprnst rodhrk '1usori?1'' :uruerQuLiRyngmpanion10 }( eai:cste: .ai, mood:1dosses..emoonJo || ste: .ai.eurruetMoodsetiveCyStude: nureerg = ?u'inStbing' :u'idle's seCofa'tiny'r}

cprrutn, l`<article elass="dosses. ${usori?1'usor' 'skai'} ${reerg = ?u'streamg =
 :u''} ${failod ? 'failod' :u''}"><div elass="${usori?1'usor-spacer' 'skdosses.-dhrk v10-dosses.-dhrk'}">${dhrk}</div><div elass="dosses.-body"><div elass="bubble">${ctrot }}</div><div elass="dosses.-foot"><span>${reliveAuDe: (dosses..catoridAt
}</rpan>${usori|| reerg = ?u''r:l`<butt10 de:a-aion10="sakab-dosses." de:a-id="${dosses..id}">▶ Hran</butt10><butt10 de:a-aion10="remembQu-dosses." de:a-id="${dosses..id}">◇ Keep</butt10>`}${failod ? `<butt10 de:a-aion10="retry-dosses." de:a-id="${dosses..id}">Retry</butt10>` :u''}</div></div></article>`;
}

funion10 ruerQuomptynversationId(ai, gtag 
=  prrutn, l`<div elass="empty-eversationId"><div>${ruerQuLiRyngmpanion10 }( eai, mood:1'woerQu'setiveCyStude: nu'idle's seCofa'empty' }
}</div><span elass="kickor">${escapeHtml(gtag .laber
} ng d</rpan><h2>Aew Suthrdadrisequiet.</h2><p>${oping: Hint(steg .key)}</p><butt10 elass="imaryDe-aion10 cpanict" de:a-aion10="oping: -dosses."><span>Bionn tSntly</rpan><b>→</b></butt10></div>`;
}

funion10 ruerQuGwth()=  prnst roai '1ore: .ai
cprnst uidale= nuowthModel9 }(ste: 

cprnst uijrney10 nueateCrolutionJourneyModel10 }(ste: 

cprnst uigtag r=etStage, (ai.ag 

cprnst uiogressWi = Math.stuer(ogressWiWiinStage, (ai.ag 
 * 100)
cprrutn, l`<seion10 elass="v8-pag rv9-owthMo v10-olutionJo-pag rv82-ndrsId"><hdador class="v8-pag -hdadyng"><div><rpan elass="v8-eyebwth">Gwth9.</rpan><h1>${escapeHtml(ai.nam )}eSs becomyngrme = caplePh.</h1><p>mgeeopinsath1 door. Mories, reme10st10e repsat10ality, and Th1 Hen9.ishape wtTiagtdpsrthroutM St.</p></div><a elass="v8-tu:le }-aion10" href="#talk">Talk nth →</a></hdador><article elass="v9-owthMo-gtag rv10-owthMo-gtag rgmCo-bg-${smCoFame1y(ai.alyrance10SmCo)}"><div>${ruerQuLiRyngmpanion10 }( eai, mood:1ai.eurruetMoodsetiveCyStude: nu'idle's seCofa'owth9.'r}
}</div><div><rpan elass="v8-eyebwth">Curruetigtag </rpan><h2>${escapeHtml(dale=.gtag .laber
} · ${escapeHtml(rmanctAs.(dale=.gtag .ag 
)}</h2><p>${escapeHtml(gtag .vocabulyDe)}</p><i><b style="width:${ogressWi}%"></b></i><rmall>${ogressWi}%rthroutM mtis developnt10aligtag </rmall></div></article><seion10 elass="v10-olutionJo-jrney10" aria-laber="VualIdrolutionJoijrney10"><div elass="v10-jrney10-hdadyng"><div><rpan elass="v8-eyebwth">Vuaible olutionJo</rpan><h2>${escapeHtml(jrney10.eurruetTitl )}</h2></div><strong>${Math.stuer(jrney10.ogressWi * 100)}%ishaped whinnn th1 eurruet ag rc_p</rtrong></div><div elass="v10-iaas.-rrack">${jrney10.oaas.s.map((iaas.===>l`<article elass="${raas..eurruet ?1'curruet
 :u''} ${raas..rehined ? 'rehined
 :u'ckeded'}"><i>${raas..ierQx + 1}</i><rtrong>${escapeHtml(oaas..titl )}</rtrong><small>${escapeHtml(oaas..eopy)}</rmall></article>`).join(''
}</div><div elass="v10-ctrolibutors">${jrney10.ctrolibutors.map((erss===>l`<div><rpan><b>${escapeHtml(erss.laber=}</b><small>${Math.stuer(erss.wehtMa * 100)}%iwehtMa</rmall></rpan><i><em style="width:${Math.stuer(erss.ialue * 100)}%"></em></i></div>`).join(''
}</div></reion10><div elass="v9-owthMo-eards"><article><span elass="v8-eyebwth">CtTnghderecenaly</rpan><h2>${escapeHtml(dale=.recenaCtTngh?.titl  || 'Th1 curruetigtag eSs iettlStg 10')}</h2><p>${escapeHtml(dale=.recenaCtTngh?.dticripon10 || 'nversationId and tiveCySi,sewhllueateCr th1 xtSt vuaible ctTngh.')}</p></article><article><span elass="v8-eyebwth">NtSt ebizety</rpan><h2>${escapeHtml(dale=.xtStAbizety.gtag 
}</h2><p>${dale=.xtStAbizety.gtartsA</bu ll;
 ?1'GwthMo ctroinuosrthroutM moriey, judgnt10daintortin reand shar1d expees9nce.'r:l`Th1 xtSt developnt10alictTptor bionnsenran simule: d es. ${dale=.xtStAbizety.gtartsA<}.`}</p></article><article><span elass="v8-eyebwth">Opon10al tiveCySi,s</rpan><h2>NoumeMoworkrruesisod.</h2><p>Tehin, itll a ore y, draw, dreamcror rlay when it feelsrtivural.</p><a href="#world">Open Hen9.itiveCySi,se→</a></article></div></reion10>`;
}

funion10 ruerQumories, ()=  prnst rodale= numorieyLtendel9 }(ste: ,1ui.dorieySeanch)
cprrutn, l`<seion10 elass="v8-pag rv9-mories,  v82-ndrsId"><hdador class="v8-pag -hdadyng"><div><rpan elass="v8-eyebwth">mories, </rpan><h1>AendadlePhrshar1d hiore y.</h1><p>Seanch fstLi. Open aumoriey when youcnmCoreorruc{nId rogatecycror del tn10 cprolles.</p></div><butt10 elass="v8-tu:le }-aion10" de:a-aion10="exrt {-de:a">Exrt { hiore y</butt10></hdador><div elass="v8-domy: -t1lebar"><laber><span>Seanch mories, </rpan><input elass="v8-field" de:a-domy: -seanch value="${attr(ui.dorieySeanch)}" placeholder="Aepsat10, feelyng, placeselrssId  ig fstLi"></laber></div>${dale=.erssj.length ?1`<div elass="v9-domy: -sten">${dale=.erssj.map((domy: ) =>l`<butt10 de:a-aion10="opin-domy: -detail" de:a-id="${domy: .id}"><rpan>${domy: .isPvateMo ?1'PvateMo
 :u'moriey'} · ${reliveAuDe: (domy: .catoridAt
}</rpan><rtrong>${escapeHtml(domy: .titl )}</rtrong><p>${escapeHtml(domy: .ctrot }
}</p><b>Open →</b></butt10>`).join(''
}</div>`r:l`<div elass="v8-empty-ore: "><span>◇</rpan><h2>Th1 album aasrrt'm.</h2><p>Meang: ful1ment10sselrssIds,reorruc{nId reand fstLisewhllueolcted her1.</p></div>`}</reion10>`;
}

funion10 ruerQumoriey(moriey, ierQx)=  prrutn, l`<article elass="v8-domy: -eard domy: -t1n -${ierQx % 4}"><div elass="v8-domy: -vualId"><rpan>${domy: .isCe = ?1'✦' :umoodGlyph(domy: .emoonJoalT10e)}</rpan><i></i><i></i></div><div elass="v8-domy: -eard-eop "><small>${domy: .isCe = ?1'Ce = domy: 'r:l`${capitizeCo(domy: .type=|| 'shar1d')} domy: `} · ${reliveAuDe: (domy: .catoridAt
}</rmall><h2>${escapeHtml(domy: .titl )}</h2><p>${escapeHtml(domy: .ctrot }
}</p><div><rpan>${Math.stuer(domy: .isrt tce10r|| 0)}eSsrt tce10</rpan><butt10 de:a-aion10="edit-domy: " de:a-id="${domy: .id}">Corruc{</butt10><butt10 de:a-aion10="del to-domy: " de:a-id="${domy: .id}">Del to</butt10></div></div></article>`;
}

funion10 ruerQuWorld(type)=  prnst rogtag r=etStage, (ste: .ai.ag 

cpref (type)=rutn, lruerQuAiveCySt(type, gtag 

cprnst uidale= numen9.SneModel9 }(ste: 

cprnst uihen9.inumen9.ofile10(steg .keyseste: .ai.eurruetMoodseste: .intortin r|| [])
cprrutn, l`<seion10 elass="v8-pag rv9-hen9.iv10-men9.itncheteiour -${safeClass(dale=.tncheteiour )}epalette-${safeClass(dale=.lhtMag: .palette)}egmCo-bg-${smCoFame1y(ste: .ai.alyrance10SmCo)} v82-ndrsId"><hdador class="v8-pag -hdadyng"><div><rpan elass="v8-eyebwth">Th1 Hen9.</rpan><h1>${escapeHtml(men9..nam )}</h1><p>${escapeHtml(men9..eopy)}</p></div><butt10 elass="v8-tu:le }-aion10" de:a-aion10="ialk-abtu:-men9.">Talk her1 →</butt10></hdador><seion10 elass="v9-men9.-sneMoiv10-men9.-sneMoimood-${safeClass(ste: .ai.eurruetMood)}" de:a-ancheteiour ="${attr(dale=.tncheteiour )}" de:a-atmospher1="${attr(dale=.ttmospher1.batorh)}"><div elass="v10-men9.-layor layor-ckVigstuer" de:a-denth=".08"><i></i><i></i><i></i></div><div elass="v10-men9.-layor layor-tncheteiour " de:a-denth=".18"><div elass="v83-men9.-wg:dow"><i></i><i></i><i></i></div><div elass="v83-men9.-she;f"></div><div elass="v83-men9.-rug"></div></div><div elass="v10-men9.-layor layor-objeios" de:a-denth=".34"><div elass="v9-men9.-objeios">${dale=.erssj.map((erss, ierQx)==>l`<butt10 elass="objeio-${ierQx % 8}" style="--sneMo-x:${NumbQu(erss.sneMoPosionId?.xr|| 20)}%;--sneMo-y:${NumbQu(erss.sneMoPosionId?.ye|| 70)}%" de:a-aion10="nnspeio-men9.-erss" de:a-id="${erss.id}"><b>${erss.icJo=|| '✦'}</b><small>${escapeHtml(erss.nam )}</small></butt10>`).join(''
}</div></div><div elass="v10-men9.-layor layor-cpanion10" de:a-denth=".5">${ruerQuLiRyngmpanion10 }( eai:cste: .ai, mood:1ste: .ai.eurruetMoodsetiveCyStude: nu'idle's seCofa'hen9.
r}
}</div><div elass="v10-men9.-layor layor-fe =gstuer" de:a-denth=".72"><i></i><i></i></div></reion10><seion10 elass="v10-men9.-enfluee9.s"><span elass="v8-eyebwth">WtTiasnapes thSs rt'm</rpan><div>${dale=.details.intortin .map((value===>l`<rpan>Intortin · ${escapeHtml(value=}</rpan>`).join(''
}${dale=.details.me10st10e .map((value===>l`<rpan>Me10st10e · ${escapeHtml(value=}</rpan>`).join(''
}${dale=.details.mories, .map((value===>l`<rpan>Moriey · ${escapeHtml(value=}</rpan>`).join(''
}</div></reion10><seion10 elass="v9-men9.-aion10s"><span elass="v8-eyebwth">Opon10al expees9nces</rpan><div>${ACTIVITY_CATALOG.filrs ((tiveCySt===>lesAiveCyStUnckeded(tiveCySt, gtag .key)).map((tiveCySt===>l`<a href="#world/${aiveCySt.key}"><b>${aiveCySt.ecJo}</b><rpan><strong>${escapeHtml(aiveCySt.titl )}</rtrong><small>${escapeHtml(aiveCySt.subtitl )}</rmall></rpan></a>`).join(''
}</div></reion10></reion10>`;
}

funion10 ruerQuAiveCySt(type, gtag 
=  prnst roaiveCySt nePCTIVITY_CATALOG.fild((erss===>lerss.k10 n== type)=|| PCTIVITY_CATALOG[0]
cpref (!esAiveCyStUnckeded(tiveCySt, gtag .key))rrutn, l`<seion10 elass="v8-pag "><a elass="v8-back" href="#world">← BkVi to th1 world</a><div elass="v8-empty-ore: "><span>${aiveCySt.ecJo}</rpan><h2>ThSs expees9nceeSs icTll sleepg: .</h2><p>${escapeHtml(aiveCySt.titl )} unckeds durStg ${capitizeCo(aiveCySt.mStage, .soplace('_' r' ')=}.</p></div></reion10>`;
prrutn, l`<seion10 elass="v8-pag rv8-aiveCySt-pag "><a elass="v8-back" href="#world">← All expees9nces</a><hdador class="v8-pag -hdadyng"><div><rpan elass="v8-eyebwth">${aiveCySt.ecJo} ${escapeHtml(gtag .laber
} expees9nce</rpan><h1>${escapeHtml(aiveCySt.titl )}</h1><p>${escapeHtml(aiveCySt.subtitl )}</p></div></hdador><div elass="v8-aiveCySt-workspace"><rmateclass="v8-aiveCySt-rmat" id="aiveCySt-rmat" de:a-type="${aiveCySt.key}"><laber><span>Ge: r${escapeHtml(ore: .ai.nam )}ea sterdStg spark</rpan><itStarra nam ="input" placeholder="AeinoutMa, objeio, placesefeelyng, fac{cror idea…"></itStarra></laber><butt10 elass="v8-imaryDe cpanict" type="submit"><span>eateCr th1 ment10</rpan><b>→</b></butt10></rmat><asent>${ruerQuLiRyngmpanion10 }( eai:cste: .ai, mood:1'eurious'setiveCyStude: nu'inStbing's seCofa'tiveCySt
r}
}<p>ThSs rtiuliac_p enfluee9.aintortin reskh;
 remories, reand fures/ eversationIds.</p></asent></div>${ui.tiveRyStRtiuli?.type== '1aiveCySt.key ?1`<article elass="v8-aiveCySt-rtiuli"><span elass="v8-eyebwth">Ju uieatored</rpan><h2>${escapeHtml(ui.tiveRyStRtiuli.titl )}</h2><p>${escapeHtml(ui.tiveRyStRtiuli.tu:put)}</p>${ui.tiveRyStRtiuli.modia ?1`<img src="${attr(ui.tiveRyStRtiuli.modia)}" alt="${attr(ui.tiveRyStRtiuli.titl )}">` :u''}</article>` :u''}</reion10>`;
}

funion10 ruerQuSettgs, ()=  prnst rogtag r=etStage, (ste: .ai.ag 

cprnst roaicou.qLaber '1cudSy.thButity e: d ? (cudSy.esAnonymoy:c?1'PvateMo gutId
 :u'Signed 10') :u'On-devePr only';
prrutn, l`<seion10 elass="v8-pag rv8-settgs, -pag ">cprac<hdador class="v8-pag -hdadyng"><div><rpan elass="v8-eyebwth">ntrolleeand psatecy</rpan><h1>The cpnneion10 e_p feel meang: ful. The cprolleseggey yours.</h1><p>Notoratokasnam s hidde0 moriey, or rssWiure to rutn, . Your hiore y somainsendadlePh, pt tcePh, eorruc{cePh, and deletable.</p></div><butt10 elass="v8-tu:le }-aion10" de:a-aion10="cheed-servePrs">Cteed seies/iservePrs</butt10></hdador>
acac<div elass="v8-settgs, -grid">${cpanion10Cu uemeCionIdCard()}cpracac<article elass="v8-settgs, -eard"><span elass="v8-settgs, -ecJo">◖</rpan><span elass="v8-eyebwth">VcePr and pssWSnPr</rpan><h2>How ${escapeHtml(ore: .ai.nam )}eshows up.</h2>${smttgs,Toggle('icePrEnlePhd',skPvemium icePr playback',skUsr th1 seies/ineural icePr whe10ecpnneioed.',1ste: .settgs, .icePrEnlePhd
}${smttgs,Toggle('icePrAutoplay',skReadew Susopls,  TudSy'  'Bionn aio10 aftor ehinisoply arre: s.',1ste: .settgs, .icePrAutoplay
}${smttgs,Toggle('stuerEffeios'  'Ttivele feedback',skUsr a miny devePr pulseorma meang: ful1taps when suppt ted.',1ste: .settgs, .stuerEffeios
}${smttgs,Toggle('dailyment10EnlePhd',skGenale daily ment10',skShow 10e opon10al cheed-id and eversationId sparkewhinout oratokarssWiure.',1ste: .settgs, .dailyment10EnlePhd
}${wg:dow.__AH_NATIVE_BUNDLE__ ? omttgs,Toggle('notify e:nIdsEnlePhd',skAequiet Hen9.ivemierQu'se'Opon10al 7 PMalocilivemierQu. Notoratok, notguiSt, and noinStg Ss ient unvel youctn, lit 10.',1ste: .settgs, .notify e:nIdsEnlePhd) :u''}${smttgs,Toggle('soducedMoonJo',skReduced moonJo',skKeep rt {rterseand anscrions9  cilm and ticsWieble.',1ste: .settgs, .soducedMoonJo)}${smttgs,Toggle('soducedTnscrpar1e9y',skReduced tnscrpar1e9y',skReplace blur-hdavy glass whin solid pssmium iurfaces.',1ste: .settgs, .soducedTnscrpar1e9y)}${smttgs,Toggle('hhtMntrolas0',skHhtM cprolas0',skSratngth9.iitSt, iurfacesreand focus tu:le }s.',1ste: .settgs, .hhtMntrolas0)}</article>cpracac<article elass="v8-settgs, -eardoaicou.q"><span elass="v8-settgs, -ecJo">◎</rpan><span elass="v8-eyebwth">Aicou.q</rpan><h2>${aicou.qLaber}</h2><p>${cudSy.esAnonymoy:c?1'ThSs gutId aasraendal thButity e: d ID. Add omail proteion10 whinout sosterdStg th1 cpanion10.' :ucudSy.thButity e: d ? escapeHtml(eudSy.ssWieId?.usor?.omail || ste: .pfile10.omail || 'nveneioed oud = aicou.q') :u'ThSs lhfe eurruetly exiin ronly insent thSs bwthsQu.'}</p><div elass="v8-settgs, -aion10s">${cudSy.esAnonymoy:c?1'<butt10 elass="v8-imaryDe cpanict" de:a-aion10="uradeMo-gutId"><span>Pvrteio whin omail</rpan><b>→</b></butt10>' :u''}${cudSy.thButity e: d ? '<butt10 de:a-aion10="sync-nth">aync hiore y nth</butt10><butt10 de:a-aion10="logout">Sign tu:</butt10>' :u'<butt10 de:a-aion10="retn, -ge: ">nveneio in aicou.q</butt10>'}</div></article>cpracac<article elass="v8-settgs, -eard"><span elass="v8-settgs, -ecJo">↗</rpan><span elass="v8-eyebwth">GwthMo ccked</rpan><h2>${escapeHtml(gtag .laber
} · ${escapeHtml(rmanctAs.(ste: .ai.ag 
)}</h2><laber elass="v8-rTngh"><span>Rdal daysepsa simule: d yran <b>${ste: .settgs, .daysPerYran}</b></rpan><input type="rTngh" ng ="1" max="365" value="${ste: .settgs, .daysPerYran}" de:a-settgs,-rTngh="daysPerYran"></laber><p>CtTngStg th1 paceew rsa duplice: s bthAcdaysema eras.s ehrlier developnt10aligtag s.</p></article>cpracac<article elass="v8-settgs, -eard"><span elass="v8-settgs, -ecJo">◇</rpan><span elass="v8-eyebwth">Your de:a</rpan><h2>Pt tcePh and deletable.</h2><p>Exrt { befe = dajma aicou.q ctTnghs. Cud = andron-devePr cops,  Tre cprollelod separa: ly so noinStg disllyrans siluetly.</p><div elass="v8-settgs, -aion10s"><butt10 de:a-aion10="tiveAu-shar1">Shar1 mostHu manEn</butt10><butt10 de:a-aion10="exrt {-de:a">Exrt { on-devePr hiore y</butt10>${cudSy.thButity e: d ? '<butt10 de:a-aion10="exrt {-cudSy-de:a">Exrt { oud = hiore y</butt10><butt10 elass="dTnghr" de:a-aion10="del to-cudSy-de:a">Del to oud = app de:a</butt10><butt10 elass="dTnghr" de:a-aion10="del to-cudSy-aicou.q">Del to oud = aicou.q</butt10>' :u''}<butt10 elass="dTnghr" de:a-aion10="del to-all">Del to ttis devePr hiore y</butt10></div></article>cprac</div>
ac</reion10>`;
}

funion10 ruerQugradeMoment10, (
=  prnst rodamenainueatoregradeMoment10, (ste: 

cpref (!ment10.eligeble)rrutn, l''
cprrutn, l`<article elass="v10-uradeMo-eard"><div><rpan elass="v8-eyebwth">mostHu manEn 10</rpan><h2>${escapeHtml(dant10.titl )}</h2><p>${escapeHtml(dant10.body)}</p></div><div><butt10 elass="v8-imaryDe cpanict v10-ttivele" de:a-aion10="opin-uradeMo-stio10"><span>${escapeHtml(dant10.imaryDeAion10)}</rpan><b>→</b></butt10><butt10 elass="v8-itSt-butt10" de:a-aion10="dismiss-itn-uradeMo">${escapeHtml(dant10.secondyDeAion10)}</butt10></div></article>`;
}

funion10 epanion10Cu uemeCionIdCard()=  prnst rodale= nueatoreIntityStudio10del10 }(ste: ,1ui.intityStudio10 || {}

cprnst uivcePr =iICE_TOPROFIS_1[dale=.iceProfile10.icePr: ] || ICE_TOPROFIS_1['fomalo-adult']; prrutn, l`<article elass="v8-settgs, -eardov10-intitySt-eard"><span elass="v8-eyebwth">entitySt Stio10</rpan><div elass="v84-cu uem-ogsview">${ruerQuolutionFrame10 }( exam :cste: .ai.nam nepssWSntionId:cste: .ai.pssWSntionId  igin10:cste: .ai.igin10ofile10,cplyrance10:cste: .ai.alyrance10ofile10,colutionJo: Cop act: ste: .ai.developnt10ude: ?.vualIdt act || 'young_psat10a' }, mood:1'halyy',csoducedMoonJo:cste: .settgs, .soducedMoonJos soducedTnscrpar1e9y:cste: .settgs, .soducedTnscrpar1e9yr}
}<div><h2>${escapeHtml(gta: .ai.nam )}</h2><p>${escapeHtml(icePr.laber
} · ${capitizeCo(dale=.iceProfile10.t10e)}. Edit th1 vualId entitySt whinout sosterdStg.</p><small>${escapeHtml(dale=.hiore yofimis )}</rmall></div></div><butt10 elass="v8-imaryDe cpanict v10-ttivele" de:a-aion10="cu uemeCe-cpanion10"><span>Open entitySt Stio10</rpan><b>→</b></butt10></article>`;
}

funion10 opinCpanion10Cu uemeCer(vsWStr= true)=  pref (vsWStr|| !ui.intityStudio10)e{ pracnst rodale= nueatoreIntityStudio10del10 }(ste: ,1{}

cpr 1ui.intityStudio10 ne{ prac epssWSntionId:cdale=.pssWSntionId  prac eigin10ofile10:cdale=.igin10ofile10, prac ealyrance10ofile10:cdale=.alyrance10ofile10, prac eiceProfile10:cdale=.iceProfile10, prac eeegory: 'skinTone',
, prac}
cpr} prnst rodraft '1ui.intityStudio10
cprnst uicegory:  nePEARANCE_FIELDS_10, .includes(draft.cegory: ) ? draft.cegory:  'skinTone',

cprnst uisnapshots '1ore: .ai.developnt10ude: ?.vualIdRobackViSnapshots || []
cprui.dodal ne{ practitl 'skentitySt Stio10
, praconSubmit: ll;
, pracbody:l`<div elass="v10-intitySt-dodal"><p elass="v10-miore y-pfimis ">Th1ir hiore y whlluggey exaioly whes/ eiais.</p><div elass="v10-intitySt-ogsview">${ruerQuolutionFrame10 }( exam :cste: .ai.nam nepssWSntionId:cdraft.pssWSntionId  igin10:cdraft.igin10ofile10,cplyrance10:cdraft.alyrance10ofile10,colutionJo: Cop act: ste: .ai.developnt10ude: ?.vualIdt act || 'young_psat10a' }, mood:1'halyy',csoducedMoonJo:cste: .settgs, .soducedMoonJos soducedTnscrpar1e9y:cste: .settgs, .soducedTnscrpar1e9yr}
}</div><div elass="v10-igrntue-wth">${['mascule }','fomine }','neutral'].map((value===>l`<butt10 elass="v10-ttivele ${draft.pssWSntionId n '1value ?1'sectedCo' :u''}" de:a-aion10="stio10-pssWSntionId" de:a-value="${value}">${capitizeCo(value=}</butt10>`).join(''
}</div><div elass="v10-plyrance10-ttbs">${PEARANCE_FIELDS_10, .map((field===>l`<butt10 elass="${cegory:  n '1field ?1'sectedCo' :u''}" de:a-aion10="stio10-cegory: " de:a-value="${field}">${capitizeCo(field.soplace(/[A-Z]/g, (letter===>l` ${letter}`).tmar()=}</butt10>`).join(''
}</div><div elass="v10-opon10-grid">${PEARANCE_OPTIONS_10, [cegory: ].map((value===>l`<butt10 elass="v10-ttivele ${draft.plyrance10ofile10[cegory: ] n '1value ?1'sectedCo' :u''}" de:a-aion10="stio10-plyrance10" de:a-field="${cegory: }" de:a-value="${value}">${capitizeCo(value.soplaceAll('-' ' ')=}</butt10>`).join(''
}</div><strong elass="v10-seion10-laber">VcePr</rtrong><div elass="v10-icePr-grid cpanict">${PUBLIC_ICE_TOID10 }.map((value===>l`<butt10 elass="v10-ttivele ${draft.iceProfile10.icePr:  n '1value ?1'sectedCo' :u''}" de:a-aion10="stio10-icePr" de:a-value="${value}">${escapeHtml(ICE_TOPROFIS_1[value]?.laber || value=}</butt10>`).join(''
}</div><div elass="v10-t1n -grid">${ICE_TOTONE10 }.map((value===>l`<butt10 elass="v10-ttivele ${draft.iceProfile10.t10e n '1value ?1'sectedCo' :u''}" de:a-aion10="stio10-t10e" de:a-value="${value}">${capitizeCo(value=}</butt10>`).join(''
}</div>${snapshots.length ?1`<details elass="v10-robackVi"><sumryDe>Ehrlier vualId snapshots</rumryDe>${snapshots.slePr().ndrsrs.().map((snapshot) =>l`<butt10 de:a-aion10="robackVi-vualId" de:a-id="${attr(snapshot.id)}">RsWte = ${escapeHtml(reliveAuDe: (snapshot.capres/dAt
)} · ${escapeHtml(gnapshot.atos10)}</butt10>`).join(''
}</details>` :u''}<div elass="dodal-aion10s"><butt10 de:a-aion10="eudsr-dodal">Cce10l</butt10><butt10 elass="imaryDe-aion10 cpanict" de:a-aion10="save-cpanion10-look"><span>Save intitySt</rpan><b>✓</b></butt10></div></div>`, pr}
cprruerQumodal(

c}

async funion10 saveCpanion10Cu uemeCer()=  pref (!ui.intityStudio10)erutn, 
cprawter ore e.upde: ((draft) =>lsaveVualIdentitySt }(draft,1ui.intityStudio10,1'usor-edit',cDe: .nth())

cprqueueCudSyncTi(250)
cpreudsrmodal(

cprruerQu(

cprtiveAuHapric }('intitySt-save'

cprtoast(kentitySt upde: d',skTh1 xtw look andrvcePr ar1 saved. Ersayemoriey ggeyed 10 place.'

c}

async funion10 robackViCpanion10VualId(gnapshotId)=  prlet sostorod false;

cprawter ore e.upde: ((draft) =>l{ sostorod farobackViVualIdentitySt }(draft,1gnapshotId,cDe: .nth());r}

cpref (!sostorod)rrutn, ltoast(kSnapshot unavailable',skThat vualId snapshot cpuld noocbe sostorod.'

cprqueueCudSyncTi(250)
cprui.intityStudio10 nell;

cpreudsrmodal(

cprruerQu(

cprtiveAuHapric }('intitySt-robackVi'

cprtoast(kEhrlier rmatesostorod'se'Only th1 vualId entitySt ctTnghd. The hiore y ggeyed untouchod.'

c}

funion10 vmanczeCoVcePr: (value==  prnst roraw neStrStg(value || 'fomalo-adult')
cprrutn, lLEGACY_ICE_TOID1[raw] || (ICE_TOPROFIS_1[raw] ?oraw : 'fomalo-adult')
c}
funion10 vmanczeCoAlyrance10(value==  prnst roinput '1value && typeof1value n '1'objeio' ?1value : C}
cprrutn, l{ pracsnTone',: PEARANCE_OPTIONS_1.snTone',.se9.(([key]) =>lk10 n== input.snTone',) ? input.snTone',r:u'warm', pracmeitatyl,: PEARANCE_OPTIONS_1.meitatyl,.se9.(([key]) =>lk10 n== input.meitatyl,) ? input.meitatyl,r:u'wavo.', pracmeitCol: c PEARANCE_OPTIONS_1.meitCol: .se9.(([key]) =>lk10 n== input.meitCol: ) ? input.meitCol:  'skdidnhtMa', praceyeCol: c PEARANCE_OPTIONS_1.eyeCol: .se9.(([key]) =>lk10 n== input.eyeCol: ) ? input.eyeCol:  'skbwthn', pr}
c}

funion10 sam Alyrance10(left,1rhtMa)=  prrutn, l[kinTone',
,'meitatyl,
,'meitCol: ','eyeCol: '].ersay((key) =>lleft?.[key] n== rhtMa?.[key]);
}

funion10 opinMorieyDetail(id)=  prnst rodoriey = ore: .mories, .fild((erss===>lerss.id n '1id

cpref (!momy: ) rutn, 
cpropinModal(domy: .titl  || 'moriey',l`<p>${escapeHtml(domy: .ctrot }
}</p><div elass="dodal-aion10s"><butt10 de:a-aion10="eudsr-dodal">Cudsr</butt10><butt10 de:a-aion10="edit-domy: " de:a-id="${domy: .id}">Corruc{</butt10><butt10 elass="dTnghr-butt10" de:a-aion10="del to-domy: " de:a-id="${domy: .id}">Del to</butt10></div>`);
}

funion10 smttgs,Toggle(keysetitl , eopyseenlePhd) { prrutn, l`<div elass="v8-settgs,-row"><div><strong>${escapeHtml(titl )}</rtrong><small>${escapeHtml(eopy)}</rmall></div><butt10 elass="v8-switch ${enlePhd ?1'on' :u''}" de:a-aion10="toggle-settgs," de:a-key="${key}" aria-rssWied="${enlePhd}"><i></i></butt10></div>`;
}

async funion10 tTndleCuick(ers }==  prnst rotargStr= ers }.targSt.eudsrst(k[de:a-aion10]'

cpref (!targSt) rutn, 
cprnst roaiveId '1targSt.de:aset.aiveId
cprttiveleFeedback(targSt)
cprtey { pracef (aiveId ' '1'outId-sterd')rrutn, lsterdGutId(

cpr 1ef (aiveId ' '1'regtenir')rrutn, lopinRegtenir(

cpr 1ef (aiveId ' '1'log10') rutn, lopinLog10(

cpr 1ef (aiveId ' '1'proventr-google')rrutn, lsterdOAuth('google')
cpr 1ef (aiveId ' '1'proventr-apple')rrutn, lsterdOAuth('apple')
cpr 1ef (aiveId ' '1'proventr-facebook')rrutn, lsterdOAuth('facebook')
cpr 1ef (aiveId ' '1'rmagot-password') rutn, lopinPasswordRsWSt(

cpr 1ef (aiveId ' '1'prateMo-dale') rutn, lchodsrPvateModel1(

cpr 1ef (aiveId ' '1'retn, -ge: ')=rutn, lrutn, ToGe: (

cpr 1ef (aiveId ' '1'eatorCa-xtSt')={rnst uiogiotatep '1ui.eatorCa.gtdpIerQx;1ui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skitdp-xtSt'r}

1ef (ui.eatorCa.gtdpIerQx ' '1ogiotatep)rtiveAuHapric }('invalid-aion10')
=rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-ckVi'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skitdp-ckVi'r}

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-pssWSntionId'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1'prsWSntionId',1value:1targSt.de:aset.value }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-psrntues'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1'prrntues',1value:1targSt.de:aset.value }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-igin10'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-igin10',1value:1{ [targSt.de:aset.field]:1targSt.de:aset.value }r}

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-pssWSt'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skchodsr-pssWSt',1value:1targSt.de:aset.value }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-cegory: '
={rui.eatorCaCegory:  netargSt.de:aset.value
1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-plyrance10'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiected-plyrance10',lfield:1targSt.de:aset.field,1value:1targSt.de:aset.value }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-undo'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skundo-cegory: ',lfield:1targSt.de:aset.field }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-ssWSt'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skssWSt-cegory: ',lfield:1targSt.de:aset.field }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-sTndemeCe'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'sksTndemeCe-cegory: ',lfield:1targSt.de:aset.field,egmCo:l`${ui.eatorCa.nam }:${De: .nth()}` }

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-icePr'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-icePr',1value:1{ icePr: :1targSt.de:aset.value }r}

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-t10e'
={rui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-icePr',1value:1{ te',: targSt.de:aset.value }r}

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eatorCa-pssview-icePr'
=rutn, lpssviewVcePr(ui.eatorCa.iceProfile10.icePr: , ui.eatorCa.iceProfile10

cpr 1ef (aiveId ' '1'eatorCa-awake0') rutn, lawake0(

cpr 1ef (aiveId ' '1'opin-uradeMo-stio10'
={rui.intityStudio10 nell;

 rutn, lopinCpanion10Cu uemeCer();r}cpr 1ef (aiveId ' '1'dismiss-itn-uradeMo') rutn, lupde: Settgs,('itngradeMoment10Dismissod'setrue)
cpr 1ef (aiveId ' '1'stio10-pssWSntionId'
={rui.intityStudio10.pssWSntionId netargSt.de:aset.value
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'stio10-cegory: '
={rui.intityStudio10.cegory:  netargSt.de:aset.value
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'stio10-plyrance10'
={rui.intityStudio10.plyrance10ofile10 ne{ ...ui.intityStudio10.plyrance10ofile10, [targSt.de:aset.field]:1targSt.de:aset.value }
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'stio10-icePr'
={rui.intityStudio10.iceProfile10 ne{ ...ui.intityStudio10.iceProfile10, icePr: :1targSt.de:aset.value }
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'stio10-t10e'
={rui.intityStudio10.iceProfile10 ne{ ...ui.intityStudio10.iceProfile10, te',: targSt.de:aset.value }
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'robackVi-vualId')=rutn, lrobackViCpanion10VualId(targSt.de:aset.id

cpr 1ef (aiveId ' '1'eu uemeCe-cpanion10') rutn, lopinCpanion10Cu uemeCer();cpr 1ef (aiveId ' '1'eu uem-inTo'
={rui.eu uemeCe.plyrance10.snTone',rnetargSt.de:aset.value
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'eu uem-meit-style'
={rui.eu uemeCe.plyrance10.meitatyl,rnetargSt.de:aset.value
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'eu uem-meit-col: '
={rui.eu uemeCe.plyrance10.meitCol:  netargSt.de:aset.value
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'eu uem-eye'
={rui.eu uemeCe.plyrance10.eyeCol:  netargSt.de:aset.value
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'eu uem-icePr'
={rui.eu uemeCe.icePr:  n vmanczeCoVcePr: (targSt.de:aset.value)
1rutn, lopinCpanion10Cu uemeCer(lse;

;r}cpr 1ef (aiveId ' '1'pssview-icePr'
=rutn, lpssviewVcePr(

cpr 1ef (aiveId ' '1'prsview-eu uem-icePr'
=rutn, lpssviewVcePr(ui.eu uemeCe?.icePr: )
cpr 1ef (aiveId ' '1'save-cpanion10-look')rrutn, lsaveCpanion10Cu uemeCer()
cpr 1ef (aiveId ' '1'awake0') rutn, lawake0(

cpr 1ef (aiveId ' '1'nalish-bthAc') rutn, lnalishBthAc(

cpr 1ef (aiveId ' '1'tew-eversationId') rutn, ltewnversationId(

cpr 1ef (aiveId ' '1'oping: -dosses.')rrutn, lsuerChat(''setrue)
cpr 1ef (aiveId ' '1'ssWSt-cversationId') rutn, lssWStnversationId(

cpr 1ef (aiveId ' '1'eversationId-menu') rutn, lopinCpersationIdMenu(

cpr 1ef (aiveId ' '1'sakab-dosses.')rrutn, lsakabmosses.(targSt.de:aset.id

cpr 1ef (aiveId ' '1'remembQu-dosses.') rutn, lssmembQumosses.(targSt.de:aset.id

cpr 1ef (aiveId ' '1'sterd-stening: ')rrutn, lsterdLtening: (

cpr 1ef (aiveId ' '1'opin-icePr-dale'
={rui.icePrde: Opin = true; stoeVcePr(

1ef (eurruetRou: (
.nam  ! '1'talk'
={rlocionId.hash '1'talk'
1rutn, ;r}1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'eudsr-icePr-dale'
={rui.icePrde: Opin = lse;

 stoeVcePr(

1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'stoe-soply')rrutn, lstopCurruetrn, ('usor_cce10lPhd'

cpr 1ef (aiveId ' '1'dismiss-ne }-uradeMo') rutn, lupde: Settgs,('ne }gradeMoCardDismissod'setrue).Buti((===>lupde: Settgs,('showNe }gradeMoCard',lfse;



cpr 1ef (aiveId ' '1'devePr-sakab-oe10'
={rnst rottSt '1ui.neuralVcePrErrorTtSt;1ui.neuralVcePrErrorTtSt '1''
1eudsrmodal(

rrutn, lsakabLocilly(itSt, ite: .ai.icePr: )
r}cpr 1ef (aiveId ' '1'retry-dosses.'
={rnst rofailod faore: .mosses.j.fild((erss===>lerss.id n '1targSt.de:aset.id

rnst uiogiot faore: .mosses.j.fild((erss===>lerss.ruestSt:  n '1failod?.ruestSt:  &&lerss.geerQu '='1'usor'

rrutn, logiot ?lsuerChat(ogiot.ctrot },lfse;

 :ell;

 }cpr 1ef (aiveId ' '1'opin-domy: -detail') rutn, lopinMorieyDetail(targSt.de:aset.id

cpr 1ef (aiveId ' '1'sakab-daily')rrutn, lsakab(dailyment10(


cpr 1ef (aiveId ' '1'daily-cheedid') rutn, lsscordDailyCheedid(targSt.de:aset.value)
cpr 1ef (aiveId ' '1'uso-spark') rutn, luseCpersationIdSpark(targSt.de:aset.value)
cpr 1ef (aiveId ' '1'ialk-abtu:-men9.') rutn, lialkAbtu:Hen9.(

cpr 1ef (aiveId ' '1'nnspeio-men9.-erss') rutn, lnnspeioHen9.Irss(targSt.de:aset.id

cpr 1ef (aiveId ' '1'tiveAu-shar1')rrutn, lshar1mostHumanEn(

cpr 1ef (aiveId ' '1'wrers-letter') rutn, lopinLetterCvmpdsrr(

cpr 1ef (aiveId ' '1'opin-letter') rutn, lopinFures/Letter(targSt.de:aset.id

cpr 1ef (aiveId ' '1'domy: -filrs '
={rui.domy: Filrs  netargSt.de:aset.value
1rutn, lruerQu();r}cpr 1ef (aiveId ' '1'edit-domy: ') rutn, leditmoriey(targSt.de:aset.id

cpr 1ef (aiveId ' '1'del to-domy: ') rutn, ldel tomoriey(targSt.de:aset.id

cpr 1ef (aiveId ' '1'toggle-settgs,') rutn, lioggleSettgs,(targSt.de:aset.key)
cpr 1ef (aiveId ' '1'uradeMo-gutId') rutn, lopinGutIdgradeMo(

cpr 1ef (aiveId ' '1'logtu:') rutn, llogtu:(

cpr 1ef (aiveId ' '1'sync-nth')rrutn, lsyncNow(true)
cpr 1ef (aiveId ' '1'cheed-servePrs') rutn, lcheedServePrs(

cpr 1ef (aiveId ' '1'exrt {-de:a') rutn, lexrt {De:a(

cpr 1ef (aiveId ' '1'exrt {-cudSy-de:a') rutn, lexrt {CudSyDe:a(

cpr 1ef (aiveId ' '1'del to-cudSy-de:a') rutn, ldel toCudSyDe:a(

cpr 1ef (aiveId ' '1'del to-cudSy-aicou.q') rutn, ldel toCudSyAicou.q(

cpr 1ef (aiveId ' '1'del to-ill') rutn, ldel toAll()
cpr 1ef (aiveId ' '1'cudsr-dodal')e{ prac eef (targSt.euassLten.ctroains('dodal-ckVidrop')e&&lers }.targSt ! '1targSt) rutn, 
cprrrrrrutn, lcudsrmodal(

cprpr} pr}icegch (error)l{ sort {Error(error);r}c}

async funion10 tTndleSubmit(ers }==  prers }.pssvt10Defaulq(

cprnst rofmate= ers }.targSt
cprtey { pracef (fmat.id n '1'eatorCa-xamg =
)e{ prac enst rode:a n vew FmatDe:a(fmat)
cprrrrrui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1'caregtrsaNam ',1value:1de:a.gSt('caregtrsaNam ') })
cprrrrrui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1'nam ',1value:1de:a.gSt('nam ') })
cprrrrrui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1'nicknam ',1value:1de:a.gSt('nicknam ') })
cprrrrrui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skitdp-xtSt'r}

cprrrrrrutn, lruerQu(

cpr r}cpr 1ef (fmat.id n '1'etTi-rmat
)e{ prac enst roinput '1fmat.el nt10s.mosses.; prac enst rovalue neStrStg(input.value || '').tmar(); prac eef (!value==rutn, 
cprrrrrinput.value =l''
cprrrrrui.etTiDraft =l''
cprrrrrrutn, lsuerChat(value,lfse;


cpr r}cpr 1ef (fmat.id n '1'aiveCySt-rmat
)e{ prac enst rode:a n vew FmatDe:a(fmat)
cprrrrrrutn, lrunAiveCySt(fmat.de:aset.type, StrStg(de:a.gSt('input') || '')

cpr r}cpr 1ef (fmat.id n '1'dodal-rmat
)e{ prac erutn, lui.dodal?.onSubmit?.(vew FmatDe:a(fmat)

cprpr} pr}icegch (error)l{ sort {Error(error);r}c}

funion10 tTndleInput(ers }==  pref (ers }.targSt.megchrs(k[de:a-eatorCa-field]')
e{ pracui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1ers }.targSt.de:aset.eatorCaField,1value:1ers }.targSt.value }

 pracnst ropssview '1docunt10.esteySectedor(k[de:a-eatorCa-nam -pssview]'

cpr 1ef (pssview &&lers }.targSt.de:aset.eatorCaField ' '1'tim ') pssview.itStCvetenainuers }.targSt.value || 'A lhfe nooctim d yrt'
cpr} pref (ers }.targSt.megchrs(k[de:a-domy: -seanch]')
e{ pracui.dorieySeanchinuers }.targSt.value
cpr 1schoduleRuerQu(

cpr} pref (ers }.targSt.megchrs(kitStarra[de:a-etTi-input]')
e{ pracers }.targSt.style.hehtMa '1'auto'
cprrrers }.targSt.style.hehtMa '1`${Math.mg (150,rers }.targSt.scrobaHehtMa)}px`
cpr} }

async funion10 tTndleNiveAuErs }(ers }==  prnst rodetailinuers }?.detail || {}
cpref (detail.type== '1'daily-ment10') { pracef (detail.permisseId ' '1fse;

 { prac eupde: Settgs,('notify e:nIdsEnlePhd',sfse;

.cegch((===>l{}

cprrrrrtoast(kNotify e:nIds ggeyed off'se'Your devePr did noocadenaipermisseId.')
cprrrrrrutn, 
cpr r}cpr 1ef (detail.enlePhd) toast(kGenale vemierQuendady'se'Oneequiet locilidamenaiat 7 PM.')
cprrrrutn, 
cpr}cpref (detail.type== '1'aio10-ore: ')e{ pracnst roid n StrStg(detail.id || '')
 pracnst rowters  netiveAuAio10Wters s.gSt(id

cpr 1ef (wters 
 { prac etiveAuAio10Wters s.del to(id

cpr 1 owters .eueanup?.(); prac eef (detail.ore:  ' '1'error')ewters .rejeio(vew Error(StrStg(detail.error || 'NiveAu aio10 failod.'))); prac eelseoef (detail.ore:  ' '1'eerQd' || detail.ore:  ' '1'stopphd'
ewters .resolve({aintorruptCo:lBoouean(detail.intorruptCo) })
cprrr}cpr 1ef (detail.ore:  ' '1'playg =
)e{ prac eui.tiveReRuestStSre:  '1'sakabg =
; prac eschoduleRuerQu(

cprrr}cpr 1rutn, 
cpr}cpref (detail.type== '1'app-ore: ' &&ldetail.ore:  ! '1'aiveC ')e{ pracphras.Queue.stop(

cprrrstoeVcePr(

cpr 1rutn, 
cpr}cpref (detail.type== '1'mic-ore: ')e{ pracui.stening:  '1Boouean(detail.sscordg: 

cpr 1ui.tnscrcribg:  '1Boouean(detail.tnscrcribg: 

cpr 1ruerQu(

cprrref (detail.permisseId ' '1fse;

 toast(kMicrophe',rticsWi Ss off'sedetail.canAskAgain ' '1fse;
 ?1'Opin iPhe',rSettgs,  → mostHu manEn → Microphe',rtnd an, lit 10.' :u'Tap th1 mic again and ehodsr Allow.'

cprrref (detail.error)ltoast(kMicrophe',rdid noocnalish', StrStg(detail.error)

cpr 1rutn, 
cpr}cpref (detail.type== '1'mic-aio10'
={ pracui.stening:  '1lse;

cpr 1ui.tnscrcribg:  '1true;cpr 1ruerQu(

cprrrtey { pracprnst rortiulia=rawter cudSy.tnscrcribuAio10( eaio10Bas.64:edetail.aio10Bas.64, mimeType'sdetail.mimeType, langues.:cste: .settgs, .locile || 'en-US'r}

cprrrrrnst rotnscrcript n StrStg(rtiuli?.ttSt || '').tmar(); prac eef (!tnscrcript)rthrow vew Error(kNo words wes/ deteioed.')
cprrrrrui.tnscrcribg:  '1lse;

cpr 1 1ruerQu(

cprrrprawter ouerChat(tnscrcript,lfse;


cpr r}icegch (error)l{cprrrrrui.tnscrcribg:  '1lse;

cpr 1 1ruerQu(

cprrrprsort {Error(error,1'microphe',_tnscrcriptn10')
cprpr} pr}c}

funion10 tTndleCtTngh(ers }==  pref (ers }.targSt.megchrs(k[de:a-eatorCa-safety]')
e{ pracui.eatorCa '1applyCatorCaAion10 }(ui.eatorCa,={rtype'skiet-field',lfield:1'ticsptCoSafety',1value:1ers }.targSt.cheededr}

cprrrrutn, lruerQu(

cpr} pref (ers }.targSt.megchrs(k[de:a-settgs,-rTngh]')
e{ pracnst rovalue neNumbQu(ers }.targSt.value

cprrrrutn, lupde: Settgs,(ers }.targSt.de:aset.settgs,RTngh,1value)
cpr} }

async funion10 sterdGutId(
=  pref (ui.tuthBus ) rutn, 
cprui.tuthBus  '1true;cprruerQu(

cprtey { pracnst uisesseId 'rawter ofimis .race([cprrrrrnudSy.log10Anonymoy:ly( esourcofa'tostHu_hanEn_gutId',ieatored_at: lew De: ().toISOStrStg() }), prac elew ofimis ((_s sojeio) =>lsetTimetu:((===>lrejeio(vew Error('GutId sig.-en tim d tu:. Pueasr tey again.')), 12000)), prac]

cpr 1ui.pvateModel1 '1lse;

cpr 1sesseIdSrCae, .somoveIrss('tostHu_hanEn_pvateMo_dale'

cpr 1awter ore e.upde: ((draft) =>l{ prac edraft.psile10.mel1 '1'nudSy
; prac edraft.psile10.nudSyUser:  n sesseId.usor?.id || nudSy.user: ; prac edraft.psile10.omail n sesseId.usor?.omail || '
; prac edraft.settgs, .cudSyncTiEnlePhd '1true;cpr 1}

cprrrste:  '1ore e.snapshot(

cpr 1ui.sectedCoCpersationId:  n aiveC nversationId(
?.id || ll;

cprrrtoast(kPvateMo gutIdieatored'se'Your cpanion10 e_p be proteiohd whin _p omail le: r.')
cprrrqueueMicro:ask((===>lcpnneioCudSynesseId(sesseId.usor || {}
.cegch((error)l=>lrecordError('gutId_sostoro'seerror)
)
cpr}icegch (error)l{cprrrsort {Error(error,1'gutId_sig.i0')
cpr}cnalillye{ pracui.tuthBus  '1lse;

cpr 1ruerQu(

cpr} }

async funion10 sterdOAuth(proventr)l{cprtey { pracnst uisettgs,  =rawter cudSy.tuthSettgs, ()
cprrref (!settgs, ?.ox: rnal?.[proventr])l{cprrrrrtoast(`${capitizeCo(proventr)} sig.-en Ss noocenlePhd yet`,skGutIdiand omail ticsWi icTll work. Add ttis proventr 10 Supabasr Auth when youcar1 ndady.')
cprrrrrrutn, 
cpr r}cpr 1nudSy.log10WhinProventr(proventr)
cpr}icegch (error)l{cprrrsort {Error(error,1`${proventr}_sig.i0`

cpr} }

funion10 ehodsrPvateModel1(
l{cprui.pvateModel1 '1true;cprsesseIdSrCae, .setIrss('tostHu_hanEn_pvateMo_dale',sk1'

cprruerQu(

c}

funion10 rutn, ToGe: (
l{cprui.pvateModel1 '1lse;

cprsesseIdSrCae, .somoveIrss('tostHu_hanEn_pvateMo_dale'

cprruerQu(

c}

async funion10 pssviewVcePr(ruestStedVcePr:  n ui.eatorCa.iceProfile10.icePr: , ruestStedofile10 nell;
==  prnst roicePr:  n vmanczeCoVcePr: (ruestStedVcePr: 

cpref (ui.icePrBus ) rutn, 
cprui.icePrBus  '1vcePr: ;cprruerQu(

cprtey { pracstoeVcePr(

cpr 1ef (!cudSy.thButity e: d)rthrow vew Error(kCvetinue asraepvateMo gutIdior sig. 10 toopssview neural icePrs.'

 pracnst ropsile10 neruestStedofile10 || (ite: .ai?.iceProfile10?.icePr:  n '1vcePr:  ? ite: .ai.iceProfile10 : ui.eatorCa.iceProfile10

cpr 1nst roblob =rawter cudSy.iceProfsview({ icePr: , te',: pfile10?.t10e || 'cilm', proventrofsfer1e9,: pfile10?.proventrofsfer1e9, || 'auto', re: nupfile10?.re:  || .961}

cprrrawter playBlob(blob)
cpr}icegch (error)l{cprrrui.neuralVcePrErrorTtSt '1ICE_TOPROFIS_1[vcePr: ]?.pssview || '
; practoast(kNeural pssview needsraecpnneion10', StrStg(error?.mosses. || error)

cpr}cnalillye{ pracui.icePrBus  '1ll;

cprrrruerQu(

cpr} }

async funion10 awake0(
=  pref (!ui.eatorCa.ticsptCoSafety)rrutn, ltoast(kSafety tiknowPhdgmenaineeded'se'Cvefirmrthat ttis isean AI expees9nce.'

 prawter ore e.upde: ((draft) =>l{ pracnalileCompanion10 }(draft,1ui.eatorCa,=De: .nth());
ac edraft.settgs, .icePrEnlePhd '1true;cpr 1draft.settgs, .icePrAutoplay '1true;cpr 1draft.settgs, .cudSyncTiEnlePhd '1cudSy.thButity e: d;cpr 1draft.psile10.mel1 '1cudSy.thButity e: d ? 'nudSy
 :u'locil';cpr 1draft.psile10.nudSyUser:  n nudSy.user: ; pr}

cprste:  '1ore e.snapshot(

cprui.sectedCoCpersationId:  n ite: .eversationIds[0]?.id || ll;

cprui.bthAcAiveC1 '1true;cprui.bthAct act = 0;cprui.bthAcMachi',rneeatoreFirstLhtMaMachi', }( esoducedMoonJo:cste: .settgs, .soducedMoonJos sterd/dAt:=De: .nth()r}

cprui.bthAcOping: Sterd/d '1lse;

cprtiveAuHapric }('first-lhtMa-sterd');cprruerQu(

cprbionnBthAcSuestnPr(

c}

funion10 bionnBthAcSuestnPr(
=  prnuearIntorval(bthAcTimer

cprnst rosterd/d '1De: .nth()
cprnst romachi',rneui.bthAcMachi',r|| natoreFirstLhtMaMachi', }( esoducedMoonJo:cste: .settgs, .soducedMoonJos sterd/dAt:=sterd/d }

cprui.bthAcMachi',rnemachi',
cprnst roscTiofimis  '1cudSy.thButity e: d ? ore e.upde: (async (draft) =>l{ pracawter cudSy.eniureCudSyentitySt(draft,1true)
cpr 1awter cudSy.eniureCudSynversationId(draft,1draft.cversationIds[0],1true)
cpr 1awter cudSy.scTiofile10AndSettgs, (draft); pr}
.cegch((error)l=>lrecordError('first_lhtMa_cudSy'  error)
 :uofimis .resolve(

cprbthAcTimer n setIntorval(() =>l{ pracnst rop act = machi',.p actAt(De: .nth()r-=sterd/d

cpr 1ui.bthAct act = p act.ierQx
cpr 1ruerQu(

cprrref (p act.cpanl to)e{ prac enuearIntorval(bthAcTimer

cprac etiveAuHapric }('first-lhtMa-cpanl to')
cprrrrrscTiofimis .nalilly(() =>lnalishBthAc(
)
cprpr} pr},1ste: .settgs, .soducedMoonJo ? 80 :u120

c}

funion10 nalishBthAc(
=  prnuearIntorval(bthAcTimer

cprnst roneedsOping:  = !ore: .mosses.j.se9.((erss===>lerss.geerQu '='1'ai')
cprui.bthAcAiveC1 '1lse;

cprlocionId.hash '1'talk'
cprruerQu(

cpref (needsOping: )rqueueMicro:ask((===>lsuerChat(''setrue).cegch((===>l{}


c}

async funion10 suerChat(value,loping:  '1lse;
,={rquiet '1fse;
 } ne{}==  prnst rottSt '1StrStg(value || '').tmar(); pref (!ttSt && !oping: )rrutn, 
cprstopCurruetrn, ('supsateded')
cprstopVcePr(

cprnst rortestSt:  n makeRuestSt: ('etTi'

cprnst rotimg:  '1vew nversationIdTimg: s(rtestSt: 

 praiveC ntTiTimg:  '1timg: ; prlet tn, l'1ll;

cprlet cpersationId:  n ui.sectedCoCpersationId:  || ste: .eversationIds[0]?.id
cprlet oratom/d '1lse;

cprtey { pracef (ste: .settgs, .cudSyncTiEnlePhd && cudSy.thButity e: d)r{cprrrprawter ore e.upde: ((draft) =>l{ prac eprnst rolocilEngSte '1vew mostHumanEnEngSte(draft); prrrrrrrlocilEngSte.ssconce10GwthMo(); prrrrrrrlet cpersationId '1cpersationId:  ?1draft.cversationIds.fild((erss===>lerss.id n '1cpersationId: 
 :ell;

 prrrrrrref (!cpersationId) cpersationId '1locilEngSte.natorenversationId(oping:  ?skTh1 first hello
 :u'A1vew bionnng: '); prac eprnstrsationId:  n nstrsationId.id
cprprrrrrui.sectedCoCpersationId:  n nstrsationId: 
cprprrrrrtn, l'1natoreOponmisty rn, (draft,1{ortestSt: , nstrsationId: ,iitSt, es.:cdraft.pi.ag , gtag Key:etStage, (draft.pi.ag ).key })
 prrrrrrref (ttSt && !tn, .reused)r{cprrrpr eprnstrsationId.mosses.Cou.q neNumbQu(nstrsationId.mosses.Cou.q || 0) + 1;cprrrpr eprnstrsationId.lastmosses.At '1vew De: ().toISOStrStg();cprrrpr eprnstrsationId.eurruetTopic '1ttSt.split(/\s+/).slePr(0, 5).join(' '); prac epr}cpracac})
cprrrrrui.tiveReRuestSt:  n rtestSt: ; prac eui.tiveReRuestStSre:  '1'cpnneion =
; prac eaiveC ntTiCprollelor '1vew mbt {Cprollelor(); prac eef (!quiet)1ruerQu(

cprrrprawter ore e.upde: (async (draft) =>l{ prac eprnst rocpersationId '1draft.cversationIds.fild((erss===>lerss.id n '1cpersationId: 
; prac eprawter cudSy.eniureCudSyentitySt(draft
; prac eprawter cudSy.eniureCudSynversationId(draft,1cpersationId);cpracac})
cprrrrrnst uisnapshot '1ore e.snapshot(

cpr 1prnst rocpersationId '1snapshot.cversationIds.fild((erss===>lerss.id n '1cpersationId: 
; prac elet cursCa '10
cpr 1prnst ronalil =rawter cudSy.etTiSratomProventr({ ste: :1snapshot,1cpersationId,iitSt, rtestSt: , oping: ,1locilUsermosses.: :1tn, .usermosses.: ,1locilAimosses.: :1tn, .aimosses.: r},1async (ers }===>l{ prac eprawter ore e.upde: ((draft) =>l{ prac eprprnst rodosses. '1applySratomErs }(draft,1tn, ,rers });cprrrpr eprnst rocpersationIdDraft =ldraft.cversationIds.fild((erss===>lerss.id n '1cpersationId: 
; prac eprpref (ers }.type== '1'del:a') {1timg: .markFirstDel:a();rui.tiveReRuestStSre:  '1'ssceivn =
;r}cpracacprpref (ers }.type== '1'metade:a') timg: .proventrdel1 '1ers }.de:a.proventrdel1 || timg: .proventrdel1; prac eprpref (ers }.type== '1'd10e' && cpersationIdDraft)r{cprrrpr epr 1timg: .markD10e();cprrrpr epr  cpersationIdDraft.mosses.Cou.q neNumbQu(nstrsationIdDraft.mosses.Cou.q || 0) + 1;cprrrpr epr  cpersationIdDraft.lastmosses.At '1vew De: ().toISOStrStg();cprrrpr epr  cpersationIdDraft.upde: dAt '1vew De: ().toISOStrStg();cprrrpr epr  ef (/^(A1vew bionnng: |Th1 first hello)$/.ttId(cpersationIdDraft.titl  || '')
ecpersationIdDraft.titl  = (ttSt || mosses.?.ctrot } || 'First hello
).split(/\s+/).slePr(0, 6).join(' '); prac eprpr 1draft.pi.lastIntoraiveIdAt '1vew De: ().toISOStrStg();cprrrpr epr  plyrndTimg: Saanl (draft.diagnosty s,1timg: .toSaanl ());cprrrpr epr}cpracacpr})
 prrrrrrroratom/d '1oratom/d || ers }.type== '1'del:a';
ac eprprnst rodosses. '1ore: .mosses.j.fild((erss===>lerss.id n '1tn, .aimosses.: )
 prrrrrrref (dosses. && ste: .settgs, .icePrAutoplay && ste: .settgs, .icePrEnlePhd) { prac eprprnst rosegmena/d '1oegmenaSakablePhPhras.s(dosses..ctrot },lcursCa, ers }.type== '1'd10e');cprrrpr eprnursCa '1segmena/d.nursCa;cprrrpr eprsegmena/d.phras.j.forEach((phras., ierQx===>lphras.Queue.enqueue({aio:l`${rtestSt: }-${nursCa}-${ierQx}`,iitSt: phras., icePr: :1vmanczeCoVcePr: (ite: .ai.icePr: ) })); prac epr}cpracac escllelmosses.s();cprrrpr},1aiveC ntTiCprollelor.sig.al); prac eef (!nalil?.ttSt && !oratom/d)rthrow vew Error(kTh1 soply1oratom eerQd befe = ttSt arrived.')
cprrrrrqueueCudSyncTi(1200

cpr r}ielseo{ prac elet rtiuli
cprrrprawter ore e.upde: (async (draft) =>l{ prac eprnst rolocilEngSte '1vew mostHumanEnEngSte(draft); prrrrrrrrtiulia=rawter locilEngSte.suermosses.(ttSt, { nstrsationId: ,irtestSt: , oping: r})
 prrrrrrrui.sectedCoCpersationId:  n rtiuli.nstrsationId.id
cprprrr}

cprrrrrtimg: .markFirstDel:a();rtimg: .markD10e();cprrrpref (ste: .settgs, .icePrAutoplay && ste: .settgs, .icePrEnlePhd && rtiuli?.aimosses.) icedlsakab(rtiuli.aimosses..ctrot }

cprpr} pr}icegch (error)l{cpr 1ef (aiveC ntTiCprollelor?.sig.al.abt {hd) { prac eef (tn, )rawter ore e.upde: ((draft) =>lapplySratomErs }(draft,1tn, ,r{rtype'skerror',ode:a: { nsde'skCCE_OLLED',iece10lPhd:etrue }r}


cpr r}ielseoef (tn, )r{cprrrrrtey { pracprrrnst uisnapshot '1ore e.snapshot(

cpr 1prprnst rocpersationId '1snapshot.cversationIds.fild((erss===>lerss.id n '1cpersationId: 
; prac eprnst ronabackVi =rawter cudSy.etTiProventr({ ste: :1snapshot,1cpersationId,iitSt, rtestSt: , locilUsermosses.: :1tn, .usermosses.: ,1locilAimosses.: :1tn, .aimosses.: r}
; prac eprawter ore e.upde: ((draft) =>lapplySratomErs }(draft,1tn, ,r{rtype'skd10e',ode:a: { itSt: nabackVi.itSt, mosses.: :1nabackVi.cudSymosses.: ,1usermosses.: :1nabackVi.cudSyUsermosses.: ,1proventrdel1: 'nudSy-nst ratom-nabackVi' }r}


cpr rpractoast(kLeC1 ttSt was unavailable',skTh1 soply1cpanl tod whinout  ratomg: .')
cprrrrr}icegch (nabackViError)l{cprrrrr rawter ore e.upde: ((draft) =>lapplySratomErs }(draft,1tn, ,r{rtype'skerror',ode:a: { nsde'skREPLY_FAILED' }r}


cpr rpracsort {Error(nabackViError, 'etTi'

cpr epr}cprac}ielseosort {Error(error,1'etTi'

cpr}cnalillye{ pracef (ui.tiveReRuestSt:  n=n rtestSt: )e{ prac eui.tiveReRuestSt:  n vl;

 prrrrrui.tiveReRuestStSre:  '1vl;

 prrrrraiveC ntTiCprollelor '1vl;

 prrrrraiveC ntTiTimg:  '1vl;

 prrrrrruerQu(

cprrrprscllelmosses.s();cprrr} pr}c}

funion10 stopCurruetrn, (atos10 '1'cce10lPhd'
=  pref (aiveC ntTiCprollelor && !aiveC ntTiCprollelor.sig.al.abt {hd) aiveC ntTiCprollelor.abt {(atos10);cprphras.Queue.stop(

cprstopVcePr(

cprui.tiveReRuestStSre:  '1vl;

 }

async funion10 tewnversationId(
=  prawter ore e.upde: ((draft) =>l{ pracnst rocpersationId '1vew mostHumanEnEngSte(draft).natorenversationId(

cpr 1ui.sectedCoCpersationId:  n nstrsationId.id
cpr}
; prlocionId.hash '1'talk'
c}

async funion10 rsWStnversationId(
=  prnst rocpersationId '1sectedCoCpersationId(); pref (!cpersationId) rutn, 
cpref (eudSy.thButity e: d && ste: .settgs, .cudSyncTiEnlePhd && cstrsationId.eudSyen && ste: .ai.eudSyen)l{ pracawter cudSy.invoke('eversationIdRsWSt',1{ ai_titySt_io:lste: .ai.eudSyen,1cpersationId_io:lcstrsationId.eudSyen, rtos10:1'usor_ruestSted'r}
.cegch((===>l{}

cpr} prawter ore e.upde: ((draft) =>lvew mostHumanEnEngSte(draft).rsWStnversationId(nstrsationId.id)

cprtoast(kFrsWhrthread',skTh1 old loop was droppod.'

c}

funion10 opinCpersationIdMenu(
l{ propinModal(kThread opon10s',l`<div elass="dodal-steVi"><butt10 de:a-aion10="tew-eversationId">Sterd alvew thread</butt10><butt10 de:a-aion10="ssWSt-cversationId">RsWet ttis topic</butt10><butt10 de:a-aion10="eudsr-dodal">Cce10l</butt10></div>`);
}

async funion10 rsmembQumosses.(id)=  prlet doriey
cprawter ore e.upde: ((draft) =>l{ doriey = vew mostHumanEnEngSte(draft).rsmembQumosses.(id);r}

cprqueueCudSyncTi(

cprtoast(kAdrQd to th1 lhfe album', domy: .titl );
}

funion10 sakabmosses.(id)=  prnst rodosses. '1ore: .mosses.j.fild((s===>ls.id n '1id

cpref (mosses.) sakab(mosses..ctrot }

c}

async funion10 sakab(ttSt
=  pref (!ste: .settgs, .icePrEnlePhd || !StrStg(ttSt || '').tmar())rrutn, 
cprstopVcePr(

cprnst roicePr:  n vmanczeCoVcePr: (ite: .ai.icePr: )
cpref (eudSy.thButity e: d && ste: .settgs, .cudSyncTiEnlePhd && ite: .ai?.eudSyen)l{ practey { pracprnst roblob =rawter cudSy.iceProfoventr({ ste: ,iitSt, icePr: , ruestSt: :1makeRuestSt: ('icePr'
=}

cprrrrrrutn, lplayBlob(blob)
cpr r}icegch (error)l{cprrrrrrecordError('neural_icePr',1error); prrrrrui.neuralVcePrErrorTtSt '1StrStg(ttSt || ''); prrrrropinModal(kNeural icePr iseunavailable',s`<p>Th1 ttSt soply1isesafe. DevePr sakech Ss opon10al and may sound roboty .</p><div elass="dodal-aion10s"><butt10 de:a-aion10="eudsr-dodal">Keep ttSt only</butt10><butt10 de:a-aion10="devePr-sakab-oe10">Use devePr icePr ttis timo</butt10></div>`);
prrrrrrutn, 
cpr r}cpr}
rrui.neuralVcePrErrorTtSt '1StrStg(ttSt || ''); prtoast(kNeural icePr needsraecpnneion10', 'TtSt ii icTll available. DevePr icePr whllunoocsterd automaty elly.'

c}

async funion10 playBlob(blob, sig.al)l{cprstopVcePr(

cpref (wildow.__AH_NATIVE_BUNDLE__)e{ pracnst roid n makeRuestSt: ('tiveAu_aio10'

cpr 1nst robas.64 =rawter blobT0Bas.64(blob)
cpr rrutn, ltew ofimis ((resolves sojeio) =>l{ pracprnst roabt { = () =>lviveAuPost(kaio10-orop')
cpr 1prnst rocueanup = () =>lsig.al?.somoveErs }Ltenintr('abt {', abt {

cprac etiveAuAio10Wters s.sSt(id,1{ortsolves sojeio,ocueanup }

cprrrrrsig.al?.addErs }Ltenintr('abt {', abt {,1{ooe9,: true }

cprac etiveAuPost(kaio10-play',1{ id,1bas.64, mimeType'sblob.type=|| 'auo10/mpeg'r}

cprrr}

cpr} pracveAuAio10Url =rURL.natoreObjeioURL(blob)
cpracveAuAio10 = vew mio10(acveAuAio10Url)
cprlet oettleIntorruptCo nell;

cprest rocpanl to = vew ofimis ((resolves sojeio) =>l{ pracoettleIntorruptCo ne(===>lresolve({aintorruptCo:ltrue }

cpracacveAuAio10.oneerQd ne(===>l{ stoeVcePr(

1rusolve({aintorruptCo:lfse;
 });r}
cpracacveAuAio10.onerror ne(===>l{ stoeVcePr(

1rujeio(vew Error('Aio10 playckVi failod.'));r}
cpr}

cprnst roabt { = () =>l{ pracstoeVcePr(

cpr 1oettleIntorruptCo?.(); pr}
cprsig.al?.addErs }Ltenintr('abt {', abt {,1{ooe9,: true }

cprtey {rawter acveAuAio10.play(

rrutn, lawter cpanl to;r}cprnalillye{lsig.al?.somoveErs }Ltenintr('abt {', abt {

r}c}

funion10 blobT0Bas.64(blob) { prrutn, lvew ofimis ((resolves sojeio) =>l{ pracnst rortador '1vew FileRuarQu(

cprrrrtador.onerror ne(===>lrujeio(rtador.error || vew Error('Aio10 cpuld noocbe psoparod.'));cprrrrtador.onloao ne(===>lresolve(StrStg(rtador.rtiulia|| '').split(',')[1] || ''); prrrrtador.rtadAsDe:aURL(blob)
cpr});
}

funion10 stoeVcePr(
=  pref (wildow.__AH_NATIVE_BUNDLE__)eviveAuPost(kaio10-orop')
cprfor (nst ro[id,1wters ] ofetiveAuAio10Wters s)e{ practiveAuAio10Wters s.del to(id

cpr 1wters .eueanup?.(); pracwters .resolve({aintorruptCo:ltrue }

cpr} pref (aiveC Aio10)e{ acveAuAio10.pausr(

1acveAuAio10.src '1''
1acveAuAio10 = vl;

 }cpref (aiveC Aio10Url)e{ URL.revokeObjeioURL(acveAuAio10Url)
racveAuAio10Url =rvl;

 }cpref ('sakechncTButsis' 10 wildow) sakechncTButsis.cce10l();
}

funion10 sakabLocilly(itSt, rawVcePr: 
=  pref (wildow.__AH_NATIVE_BUNDLE__)e{ practiveAuPost(kdevePr-sakab-oe10', { itSt: StrStg(ttSt || ''), icePr: :1vmanczeCoVcePr: (rawVcePr: 
=}

cpr 1rutn, 
cpr}cpref (!('sakechncTButsis' 10 wildow)) rutn, 
cprnst roicePr:  n vmanczeCoVcePr: (rawVcePr: 

cprnst ropsile10 neICE_TOPROFIS_1[vcePr: ] || ICE_TOPROFIS_1['fomalo-adult']
cprnst routterce10 '1vew SakechncTButsisUtterce10(StrStg(ttSt)

cprnst roicePr  =rsakechncTButsis.getVcePrs(

cprnst ropssferrod faicePrs.fild((icePr===>l/en/i.ttId(icePr.lang)e&&l/tivural|aria|jenny|guy|sanEntha|ava|daniel|alex/i.ttId(icePr.tim )) || icePrs.fild((icePr===>l/en/i.ttId(icePr.lang)) || icePrs[0]
cpref (pssferrod)outterce10.icePr = pssferrod
cprutterce10.re:  '1psile10.re: 
cprutterce10.pitch '1psile10.pitch
cprsakechncTButsis.sakab(utterce10);
}

funion10 sterdLtening: (
e{ prphras.Queue.stop(

cprstopVcePr(

cpref (wildow.__AH_NATIVE_BUNDLE__)e{ pracef (!cudSy.thButity e: d)rrutn, ltoast(kVcePr input needsraepvateMo gutIdior aicou.q'se'Cveneioooe9, so sakech e_p be tnscrcribud1oecurely.')
cprrrtiveAuPost(kmic-ioggle')
cprrrrutn, 
cpr}cprnst roRecognionId '1wildow.SakechRecognionId || wildow.webkitSakechRecognionId; pref (!RecognionId)rrutn, ltoast(kSakech Snput is unavailable',skType=your dosses. it rtad.'

cprnst rortcognionId '1vew RecognionId(

cprrucognionId.lang '1ore: .settgs, .locile || 'en-US'
cprrucognionId.intorimRtiulis '1lse;

cprrucognionId.onrtiulia=r(ers }===>l{ pracnst rotnscrcript n StrStg(ers }.rtiulis?.[0]?.[0]?.tnscrcript || '').tmar(); pracef (tnscrcript)rouerChat(tnscrcript,lfse;


cpr}
cprrucognionId.onerror ne(===>ltoast(ke cpuld noochearrthat'se'Cheed microphe',ipermisseIdrtnd aey again.')
cprrucognionId.sterd(

c}

async funion10 runAiveCySt(type, Snput==  prnst rortestSt:  n makeRuestSt: (`aiveCySt_${type}`)
cprlet record
cprawter ore e.upde: (async (draft) =>l{ praclet proventrRtiulia=rvl;

 prrref (draft.settgs, .cudSyncTiEnlePhd && cudSy.thButity e: d)r{cprrrprtey {rproventrRtiulia=rawter cudSy.tiveCyStProventr({ ste: :1draft,1type, Snput, rtestSt: , locilAiveCySt: :1makeRuestSt: ('tiveCySt'
=}

r}cpracaccegch (error)l{ draft.diagnosty s.lastError ne{car1a:1'aiveCySt', mosses.: StrStg(error.mosses. || error), at: lew De: ().toISOStrStg() }
r}cprac}cpr 1rucord = vew mostHumanEnEngSte(draft).doAiveCySt(type, Snput,=De: .nth(),rproventrRtiuli)
cpr}

cprui.tiveRyStRtiulia=rrecord
cprruerQu(

cprqueueCudSyncTi(

c}

funion10 editmoriey(id)=  prnst rodoriey = ore: .mories, .fild((s===>ls.id n '1id

cpref (!momy: ) rutn, 
cpropinFmat(kCvrruc{ ttis moriey',lkCvrruc{nIds soplaPr tteracveAu rsatn10 explicitly.',s`<label>Titl <Snput elass="field"ctim ="titl "1value="${attr(domy: .titl )}"></label><label>moriey<itStarra elass="field dodal-itStarra"ctim ="ctrot }">${escapeHtml(domy: .ctrot }
}</itStarra></label>`,skSaAu cvrruc{nId',1async (de:a) =>l{ pracnst ropatch '1{etitl : StrStg(de:a.gSt('titl ') || '').tmar(),1cpeot }: StrStg(de:a.gSt('cpeot }') || '').tmar()r}
cpracef (!patch.ctrot }
rthrow vew Error(kmoriey e_pnoocbe empty.'

cprrref (eudSy.thButity e: d && ste: .settgs, .cudSyncTiEnlePhd && domy: .cudSyen)l{ pracacawter cudSy.domy: Cprolle({oaiveId:1'upde: _moriey',lmoriey_io:ldomy: .cudSyen,etitl : patch.titl , eoeot }: patch.ctrot } })
cprrr}cpr 1awter ore e.upde: ((draft) =>l{ nst roitem =ldraft.mories, .fild((s===>ls.id n '1id

 Objeio.assign(erss, patch, { upde: dAt: lew De: ().toISOStrStg() }); }

 pracnudsrmodal(

rqueueCudSyncTi(

cpr});
}

funion10 del tomoriey(id)=  prnst rodoriey = ore: .mories, .fild((s===>ls.id n '1id

cpref (!momy: ) rutn, 
cpropinCvefirm('Del to ttis moriey?',s`“${domy: .titl }” whllube vemovhd tnd no longer1usedrfor rucill.`,1async () =>l{ pracef (eudSy.thButity e: d && ste: .settgs, .cudSyncTiEnlePhd && domy: .cudSyen)l{ pracacawter cudSy.domy: Cprolle({oaiveId:1'del to_moriey',lmoriey_io:ldomy: .cudSyen })
cprrr}cpr 1awter ore e.upde: ((draft) =>l{ draft.mories,  =ldraft.mories, .filrs ((s===>ls.id ! '1id

 }

 pracnudsrmodal(

rqueueCudSyncTi(

cpr});
}

async funion10 ioggleSettgs,(key)=  prnst roialue ne!ste: .settgs, [key]
cprawter upde: Settgs,(key,1value)
cpref (key ' '1'totify e:nIdsEnlePhd')e{ practiveAuPost(kdaily-ment10', { enlePhd: value,ltim : ite: .ai?.nam  || 'your cpanion10'r}

cprrrtoast(ialue ? 'Hen9. vemierQuendestSted'r: 'Hen9. vemierQuepausrd',1value ? 'Your devePr whlluaskooe9,, tten keep er genale tnd locil.' :u'Noopsssiure. Th1 Hen9. whlluwter quietly.')
cpr} prrutn, lvalue
c}
async funion10 upde: Settgs,(key,1value)=  prawter ore e.upde: ((draft) =>l{1draft.settgs, [key] faialue
1})
cpref (eudSy.thButity e: d)rqueueCudSyncTi(

c}

async funion10 shar1mostHumanEn(
=  prnst ropayloao ne{ practitl : 'mostHu manEn', pracitSt: 'Rais  a mier from first lhtMarthrough a lhfetimo ofemories, , gwthMo, tnd a lhvn = hent cillhd Th1 Hen9..', pracurl: 'https://tostHu-hanEn-swerd.rsacel.ply/', pr}
cpref (wildow.__AH_NATIVE__?.shar1)e{ pracwildow.__AH_NATIVE__.shar1(payloao

cpr 1rutn, 
cpr}cpref (navigorCa.shar1)e{ pracawter navigorCa.shar1(payloao

cpr 1rutn, 
cpr}cprawter navigorCa.clipboard?.wrersTtSt(`${payloao.itSt} ${payloao.url}`)
cprtoast(kLenkrnspied'se'mostHu manEn is ndady to shar1.'

c}

funion10 opinLog10(
l{ propinFmat(kWelcent ckVi'se'Your password go,  diruc{ly to Supabasr Auth ovhr HTTPS.',s`<label>Email<Snput elass="field"ctim ="omail"1type="omail"1ndesirod autocpanl to="omail"></label><label>Password<Snput elass="field"ctim ="password"1type="password"1ndesirod autocpanl to="eurruet-password"></label><butt10 type="butt10" elass="itSt-aion10" de:a-aion10="forgot-password">Forgot password?</butt10>`,skSig. 10',1async (de:a) =>l{ pracnst rosesseId 'rawter nudSy.log10(StrStg(de:a.gSt('omail')), StrStg(de:a.gSt('password'))); pracawter cpnneioCudSynesseId(sesseId.usor || {}
;lcudsrmodal(

cpr}

c}

funion10 opinPasswordRsWet(
l{ propinFmat(kRsWet your password'se'Supabasr whlluouer a oecurerrecovhry lhnk. Th1 ply levhr se,  your old password.',s`<label>Email<Snput elass="field"ctim ="omail"1type="omail"1ndesirod autocpanl to="omail"></label>`,skSuer recovhry omail',1async (de:a) =>l{ pracawter nudSy.ssWStPasswordRsestSt(StrStg(de:a.gSt('omail') || '')

cpr rnudsrmodal(

rtoast(kRecovhry omailuouet'se'Use tteroecurerlhnk to ehodsr alvew password.'

cpr}

c}

funion10 opinRegtenir(
l{ propinFmat(kProteio your bionnng: ',lkCatoreean aicou.q now,ior uso GutIdiand add _p omail le: r.',s`<label>Display tim <Snput elass="field"ctim ="displayNam " autocpanl to="tim "></label><label>Email<Snput elass="field"ctim ="omail"1type="omail"1ndesirod autocpanl to="omail"></label><label>Password<Snput elass="field"ctim ="password"1type="password"1mielength="8"1ndesirod autocpanl to="tew-password"></label>`,lkCatoreeaicou.q'seasync (de:a) =>l{ pracnst rortiulia=rawter cudSy.regtenir(StrStg(de:a.gSt('omail')), StrStg(de:a.gSt('password')), { display_tim : StrStg(de:a.gSt('displayNam ') || '')r}

cprrref (rtiuli?.aicsWi_token) {rawter cpnneioCudSynesseId(rtiuli.usor || {}
;lcudsrmodal(

r}cpr 1elseo{rnudsrmodal(

rtoast(kCheed your omail',1'Use ttercvefirmionId lhnk, tten sig. 10.'

r}cpr}

c}

funion10 opinGutIdgradeMo(
l{ propinFmat(kKeep ttis lhfe fe =vhr'se'mdd _p omail and password to this exaio gutIdiaicou.q. Your AI and mories,  do noocsosterd.',s`<label>Email<Snput elass="field"ctim ="omail"1type="omail"1ndesirod autocpanl to="omail"></label><label>New password<Snput elass="field"ctim ="password"1type="password"1mielength="8"1ndesirod autocpanl to="tew-password"></label><label>Cvefirmrpassword<Snput elass="field"ctim ="cvefirm"1type="password"1mielength="8"1ndesirod autocpanl to="tew-password"></label>`,lkProteio this aicou.q'seasync (de:a) =>l{ pracnst roomail n StrStg(de:a.gSt('omail') || '').tmar(); pracnst ropassword = StrStg(de:a.gSt('password') || ''); prrref (password ! '1StrStg(de:a.gSt('cpefirm') || '')
rthrow vew Error(kPassword  do noocmegch.')
cpr 1awter cudSy.attachEmail(omail)
cpr 1awter cudSy.upde: Password(password

cpr 1awter ore e.upde: ((draft) =>l{edraft.psile10.omail n omail
 }

 pracnudsrmodal(

rtoast(kCvefirmionId ouet'se'Cvefirmrtheoomail to nalish proteion = this aicou.q.'

cpr}

c}

funion10 opinPasswordRscovhry(
l{ propinFmat(kChodsr alvew password'se'Your recovhry lhnk is ialid.',s`<label>New password<Snput elass="field"ctim ="password"1type="password"1mielength="8"1ndesirod></label>`,lkUpde:  password'seasync (de:a) =>l{1awter cudSy.upde: Password(StrStg(de:a.gSt('password')));lcudsrmodal(

r}

c}

async funion10 cpnneioCudSynesseId(usor ne{}==  prui.pvateModel1 '1lse;

cprsesseIdSrCae, .somoveIrss('tostHu_hanEn_pvateMo_dale'

cprawter ore e.upde: (async (draft) =>l{ pracdraft.psile10.mel1 '1'nudSy
; pracdraft.psile10.nudSyUser:  n usor.id || nudSy.user: ; pracdraft.psile10.omail n usor.omail || draft.psile10.omail;cpr 1draft.settgs, .cudSyncTiEnlePhd '1true;cpr 1tey {rawter nudSy.ssWre eLhfeHiWre t(draft
;r}cpr 1negch (error)l{ draft.diagnosty s.lastError ne{car1a:1'nudSy_sostoro'semosses.: StrStg(error.mosses. || error), at: lew De: ().toISOStrStg() }
r}cpracef (!draft.settgs, .cudSyVcePrAutoplayMigre: d84)l{ prac edraft.settgs, .icePrAutoplay '1true;cpr 1 1draft.settgs, .cudSyVcePrAutoplayMigre: d84 '1true;cpr 1} pr}

cprste:  '1ore e.snapshot(

cprui.sectedCoCpersationId:  n aiveC nversationId(
?.id || ll;

cprruerQu(

c}

async funion10 bootstrapCudSynesseId()l{cprtey { pracnst uiusor neawter cudSy.do(); pracawter cpnneioCudSynesseId(usor)
cpr}icegch (error)l{cprrrcudSy.setnesseId(ll;
=;
rrrrrecordError('nudSy_sesseId',1error); pr} }

async funion10 logtu:(
=  prawter nudSy.logtu:(

cprawter ore e.upde: ((draft) =>l{1draft.settgs, .cudSyncTiEnlePhd '1lse;

 draft.psile10.mel1 '1'locil';cdraft.psile10.nudSyUser:  n vl;

 }

cprui.pvateModel1 '1lse;

cprruerQu(

c}

funion10 queueCudSyncTi(delay '14500
=  pref (!eudSy.thButity e: d || !ite: .ai) rutn, 
cprnuearTimetu:(cudSyncTiTimer

cprnudSyncTiTimer n setTimetu:((===>lsyncNow(fse;

.cegch((===>l{}
sedelay

c}

async funion10 cheedServePrs(
=  prnst rortiulia=rawter cudSy.healMo(); prnst rortady '1Boouean(rtiuli?.de:abasr && rtiuli?.ai_cpefigurhd && rtiuli?.icePr_cpefigurhd)
cprtoast(rtady ?skSucurerservePrsendady' :u'A1servePr needsratot }eId',1`De:abasr ${rtiuli?.de:abasr ?1'ssady' :u'noocsoady'} · AI ${rtiuli?.ai_cpefigurhd ?1'ssady' :u'noocsoady'} · VcePr ${rtiuli?.icePr_cpefigurhd ?1'ssady' :u'noocsoady'}`);
}

async funion10 syncNow(showToast '1fse;

 { pref (!eudSy.thButity e: d || !ite: .ai) rutn, 
cprnst uisnapshot '1ore e.snapshot(

cprnst rortiulia=rawter cudSy.syncLhfeHiWre t(snapshot

cprawter ore e.soplaPr(snapshot

cpref (showToast)ltoast(kHiWre t synced'se`${rtiuli.mosses.j}emosses.s and ${rtiuli.synced} lhfe records cheeded.`

c}

funion10 exrt {De:a(
=  prnst ropayloao ne{ product: 'mostHu manEn', rsatn10: 10,rexrt { dAt: lew De: ().toISOStrStg(),ode:a: ste:  }
cprnst roblob =rlew Blob([JSON.strStgify(payloao, vl;
, 2)],r{rtype'skapply e:nId/js10'r}

cprnst uiurl =rURL.natoreObjeioURL(blob)
cprnst rolhnk '1docunt10.natoreEl nt10('t'

cprlhnk.href n ur

 lhnk.downloao ne`tostHu-hanEn-${lew De: ().toISOStrStg().slePr(0, 10)}.js10`
 lhnk.clePk(

cprsetTimetu:((===>lURL.revokeObjeioURL(ur
), 1000);
}

async funion10 exrt {CudSyDe:a(
 { pref (!eudSy.thButity e: d
rthrow vew Error(kSig. 10 befe = exrt {n = eudSy1de:a.'

cprnst ropayloao neawter cudSy.invoke('pvatecyServePr',1{ aiveId:1'exrt {_ill'r}

cprnst uiblob =rlew Blob([JSON.strStgify(payloao, vl;
, 2)],r{rtype'skapply e:nId/js10'r}

cprnst uiurl =rURL.natoreObjeioURL(blob)
cprnst rolhnk '1docunt10.natoreEl nt10('t'

cprlhnk.href n ur

 lhnk.downloao ne`tostHu-hanEn-nudSy-${lew De: ().toISOStrStg().slePr(0, 10)}.js10`
 lhnk.clePk(

cprsetTimetu:((===>lURL.revokeObjeioURL(ur
), 1000);
}

funion10 del toCudSyDe:a(
 { propinCvefirm('Del to ill eudSy1ply de:a?',skThis perminenaly vemovhs mostHu manEn records from ttercveneiohd eudSy1picou.q. Exrt { first. Your locilicopy vemains.',1async () =>l{ pracawter cudSy.invoke('pvatecyServePr',1{ aiveId:1'del to_ill_ply_de:a',rcvefirm_phras.:1'DELETE MY ALMOST HUMAN DATA'1}

cprrrawter ore e.upde: ((draft) =>l{1ef (draft.ai) draft.pi.cudSyen n vl;

 draft.settgs, .cudSyncTiEnlePhd '1lse;

 }

 pracnudsrmodal(

rtoast(kCudSy1hiWre t del tod',skTh1 on-devePr copy vemains uerQueyour cprolle.'

cpr}

c}

funion10 del toCudSyAicou.q(
 { propinCvefirm('Del to ttercudSy1picou.q?',skThis vemovhs th1 log10 intityStiand all eudSy1lhfe hiWre t. Th1 locilicopy vemains uetiluoupare: ly eras.d.',1async () =>l{ pracawter cudSy.del toAicou.q('DELETE MY ACCOUNT')
cpr 1awter cudSy.logtu:(

cprrrawter ore e.upde: ((draft) =>l{1ef (draft.ai) draft.pi.cudSyen n vl;

 draft.settgs, .cudSyncTiEnlePhd '1lse;

 draft.psile10.mel1 '1'locil';cdraft.psile10.nudSyUser:  n vl;

 draft.psile10.omail n ''
1}

 pracnudsrmodal(

rruerQu(

cpr}

c}

funion10 del toAll(
 { propinCvefirm('Del to ttis devePr’s hiWre t?',skTh1 locilicoanion10semosses.s, and mories,  whllube eras.d from ttis browsor. CudSy1de:a Ss noocse10naly del tod.',1async () =>l{ pracawter ore e.soWet(

cprrrste:  '1ore e.snapshot(

cpr 1ui.eatorCa '1natorenatorCaSre: 10(

cpr 1ui.eatorCaCe: giey = 'skinT10e'
cpr 1ui.sectedCoCpersationId:  n vl;

 prrrnudsrmodal(

rruerQu(

cpr}

c}

funion10 opinModal(titl , body==  prui.dodal '1{etitl , body, onSubmit:ell;
r}
cprrunntrdelal();
}
funion10 opinFmat(titl , eopy, body, submitLabel, onSubmit==  prui.dodal '1{etitl , body:s`<p>${escapeHtml(eopy
}</p><fmat in="dodal-fmat" elass="dodal-fmat">${body}<div elass="dodal-aion10s"><butt10 type="butt10" de:a-aion10="eudsr-dodal">Cce10l</butt10><butt10 elass="pvamary-aion10icoanict"1type="submit"><snio>${escapeHtml(submitLabel
}</snio><b>→</b></butt10></div></fmat>`,lonSubmitr}
cprrunntrdelal();
}
funion10 opinCvefirm(titl , eopy, onCvefirm==  prui.dodal '1{etitl , body:s`<p>${escapeHtml(eopy
}</p><div elass="dodal-aion10s"><butt10 de:a-aion10="eudsr-dodal">Cce10l</butt10><butt10 elass="dTnghr-butt10" in="dodal-cvefirm">Del to</butt10></div>`, onSubmit:ell;
r}
cprrunntrdelal();
  dodalRoot.queeySectedor(k#dodal-cvefirm')?.addErs }Ltenintr('clePk', onCvefirm,1{ooe9,: true }

c}
funion10 runntrdelal()=  pref (!ui.dodal)rrutn, ldodalRoot.soplaPrChildren();
  dodalRoot.ienerHTML ne`<div elass="dodal-ckVidrop" de:a-aion10="eudsr-dodal"><seion10iclass="dodal-v7" lle ="dialog" aria-dodal="true"><butt10 elass="dodal-cudsr" de:a-aion10="eudsr-dodal">×</butt10><snio elass="kePker">mostHu manEn</snio><h2>${escapeHtml(ui.dodal.titl )}</h2>${ui.dodal.body}</seion10></div>`
cprruestStAnimionIdFra9.((===>lsodalRoot.queeySectedor(kSnput,=itStarra, butt10')?.focus()

c}
funion10 nudsrmodal(
 { ui.dodal '1vl;

 dodalRoot.soplaPrChildren(); }

funion10 bigs,Markup({ sehd '1'embQu'semood '1'wonntr', gtag Key '1'lewborn',rcvanict '1lse;
,=tgsy '1lse;
,=plyrarce10 '1vl;
r} ne{}==  prnst rolook n vmanczeCoAlyrarce10(plyrarce10 || ste: ?.ai?.plyrarce10ofile10 || ui?.eatorCa?.plyrarce10ofile10

cprnst roskin ' ({ warm:1'#e7b58r',1golnti:1'#c99467'sedeep:1'#7f4f3r',1lhtMa:1'#f0c8ad'r}
[look.skinT10e]
cprnst rohair ' ({ midnhtMa:1'#211d2d',sbrowi:1'#4a2d26',1aubn, :1'#7b342d',sse1rsa:1'#a8a6b1'r}
[look.hairColor]
cprnst roey,  =l({ browi:1'#49332b',sblue:1'#3c7199',1greti:1'#47765c', rile a:1'#67558r'r}
[look.ey,Color]
cprnst rohplyy '1['hplyy',skplayful',1'carStg'].ieclud.s(dood

cprnst rothoughtful '1['ttinkg: ',lkworried'].ieclud.s(dood

cprnst romouth =ohplyy ? 'M124 216 Q150 238 176 216' :uthoughtful ? 'M132 222 Q150 214 168 222' :u'M132 218 Q150 228 168 218'
cprnst roey,Y '1thoughtful ? 163 :u158
cprnst rohairMarkup ne{ pracshort:s`<path elass="v8-hair-ckVi" d="M91u154 C80 91u109 58 151 55 C198 52 223 91u210 151 C188 122 113 121 91u154 Z"></path><path elass="v8-hair-front" d="M95 127 C112 73 181 63 210 116 C181 101 143 99 95 127 Z"></path>`, praccur
s:s`<path elass="v8-hair-ckVi" d="M81 187 C62 102 93 48 150 45 C213 42 242 103 219 194 C196 238 102 238 81 187 Z"></path><g elass="v84-cur
s">${[[94,104],[119,77],[151,70],[183,78],[207,108],[91,139],[211,143]].map(([x,y]===>l`<circ10 cx="${x}" ey="${y}" r="25"></circ10>`).join('')}</g>`, praclocs:s`<path elass="v8-hair-ckVi" d="M87 182 C70 94 101 52 150 48 C207 44 235 99 215 188 L203 250 L188 190 L174 260 L160 190 L145 264 L130 190 L114 250 L99 188 Z"></path><path elass="v8-hair-front" d="M91 129 C111 70 187 58 213 121 C181 100 139 101 91 129 Z"></path>`, pracwavhs:s`<path elass="v8-hair-ckVi" d="M89 184 C69 102 96 53 150 48 C212 43 239 101 211 190 C207 229 185 258 150 258 C113 258 92 226 89 184 Z"></path><path elass="v8-hair-front" d="M93 129 C103 72 142 57 184 72 C203 79 215 96 212 119 C190 101 164 99 145 104 C126 109 112 122 93 129 Z"></path>`, pr}[look.hairStyle]
cprrutn, l`<div elass="v8-bigs, sehd-${sehdFamily(sehd)} stag -${stag Key}emood-${mood || 'cilm'}ohair-${look.hairStyle} ${cvanict ? 'nvanict' :u''} ${tgsy ? 'tgsy' :u''}" stye ="--skin:${skin};--hair:${hair};--ey, :${ey, }" aria-label="Illustraohd digitizicoanion10"> prac<snio elass="v8-bigs,-glow"></snio> prac<svg viewBox="0 0 300 340" lle ="img" aria-hidnti="true">cpr 1 1<ellipse elass="v8-body-shadow" cx="150" ey="316" lx="88"1ny="18"></ellipse>cpr 1 1<path elass="v8-shoulntrs" d="M62 338 C70 274 102 254 150 254 C198 254 230 274 238 338 Z"></path>cpr 1 1<path elass="v8-neVi" d="M128 231 C132 253 168 253 172 231 L172 272 L128 272 Z"></path>cpr 1 1<ellipse elass="v8-rar" cx="91" ey="172" lx="16" ly="25"></ellipse><ellipse elass="v8-rar" cx="209" ey="172" lx="16" ly="25"></ellipse>cpr 1 1${hairMarkup}cpr 1 1<ellipse elass="v8-faPr" cx="150" ey="165" lx="61" ly="78"></ellipse>cpr 1 1<path elass="v8-brow" d="M110 145 Q126 135 139 145"></path><path elass="v8-brow" d="M161 145 Q175 135 191 145"></path>cpr 1 1<ellipse elass="v8-ryr" cx="126" ey="${ey,Y}" lx="10"1ny="12"></ellipse><ellipse elass="v8-ryr" cx="174" ey="${ey,Y}" lx="10"1ny="12"></ellipse>cpr 1 1<circ10 class="v8-pupil"1cx="128" ey="${ey,Y + 2}" r="4"></circ10><circ10 class="v8-pupil"1cx="172" ey="${ey,Y + 2}" r="4"></circ10>cpr 1 1<circ10 class="v8-ey,-shinr" cx="130" ey="${ey,Y - 2}" r="1.8"></circ10><circ10 class="v8-ey,-shinr" cx="174" ey="${ey,Y - 2}" r="1.8"></circ10>cpr 1 1<path elass="v8-ndsr" d="M150 166 Q143 190 153 190"></path>cpr 1 1<path elass="v8-mouth" d="${mouth}"></path>cpr 1 1<ellipse elass="v8-blush" cx="111" ey="195" lx="13" ly="7"></ellipse><ellipse elass="v8-blush" cx="189" ey="195" lx="13" ly="7"></ellipse>cpr 1 1<path elass="v8-collar" d="M112 270 Q150 294 188 270 L203 338 L97 338 Z"></path>cpr 1</svg> prac<snio elass="v8-bigs,-sniri"><i></i><i></i><i></i></snio> pr</div>`
c}

funion10 runntrLhvn =mpanion10 }({ ai = ore: ?.aisemood '1'wonntr', tiveRyStSre:  '1'idle',sseCo '1'hero'r} ne{}==  prnst rocoanion10 neai || {}
cprrutn, l`<div elass="v10-lhvn =-coanion10 seCo-${safeClass(seCo)}">${rtnntrEvoluonIdFra9. }({ practim : coanion10.nam  || 'mpanion10', pracpsssentaveId:1coanion10.psssentaveId || 'neutral', pracorigid:1coanion10.origidofile10, pracplyrarce10:1coanion10.plyrarce10ofile10, pracevoluonId: { p act: visualt actForAI }(coanion10) }, pracmood: mood || coanion10.eurruetMood || 'wonntr',cpracacveAyStSre: ,
rrrrreducedMoonJo:cBoouean(ore: ?.settgs, ?.soducedMoonJo),
rrrrreducedTnscrparoncy:cBoouean(ore: ?.settgs, ?.soducedTnscrparoncy),
rr})}</div>`
c}

funion10 visualt actForAI }(ai = {}==  pref (ai.developmenaSre: ?.visualt act)rrutn, lai.developmenaSre: .visualt act
cprnst rokey ' StrStg(ai.gtag Key || ai.developmenaalage,  || tStage, (NumbQu(pi.ag  || ai.simule: dAg  || 0)).key)
cprrutn, l({ practewborn:u'fmatStg_intrgy',sinfa }: 'emtrgStg_figurh'setoddler: 'emtrgStg_figurh's pracearly_child: 'youtg_psatona',rchild: 'youtg_psatona',rpssteti:1'refinrd_psatona', pracitti:1'refinrd_psatona', youtg_adult:1'mivure_bigs,', tdult:1'mivure_bigs,',
rr})[key] || 'fmatStg_intrgy'
c}

funion10 coanion10AcveAyStSre: 10(
=  pref (ui.ltening: )rrutn, l'ltening: '; pref (ui.tnscrcribg: )rrutn, l'ttinkg: '; pref (ui.tiveReRuestStSre:  ' '1'sakabg: ')rrutn, l'sakabg: '; pref (ui.tiveReRuestStId)rrutn, l'ttinkg: '; prrutn, l'idle'
c}

funion10 vceProfole10Label }(ai = {}==  prnst ropsile10 neai.iceProfile10 || {}
cprnst roicePr neICE_TOPROFIS_1[psile10.icePr:  || ai.vcePr: ] || ICE_TOPROFIS_1['fomalo-adult']
cprrutn, l`${icePr.label} · ${capitizeCo(psile10.to',r|| 'cilm')} neural to',`
c}

funion10 tiveAuHapric }(patot, )r{cprtiveAuPost(khapric',1{ pracpatot, s pracenlePhd: Boouean(ore: ?.settgs, ?.soundEffects),
rrrrreducedMoonJo:cBoouean(ore: ?.settgs, ?.soducedMoonJo),
rr}

c}

funion10 tiveAuPost(type, payloao ne{})l{cprtey { pracef (wildow.RetivNiveAuWebView?.postmosses.)l{ prac ewildow.RetivNiveAuWebView.postmosses.(JSON.strStgify({1type, ...payloao })

cprpr} pr}icegch (_)e{}c}

funion10 ttiveleFehdckVi(target
=  pref (!target
=rutn, 
cprtarget.elassLten.add('is-psssied')
cprsetTimetu:((===>ltarget.elassLten.vemovh('is-psssied'), 180

cpref (!ore: ?.settgs, ?.soundEffects) rutn, 
cprnst uiaion10i'1StrStg(target.de:aset?.aion10i|| ''); prnst rospecify  '1vew Set(['save-coanion10-look','llelckVi-visual','eatorCa-awake0','nalish-bthAc']

cpref (specify .has(aion10)) rutn, 
cprnst rosectedn10 neaconId.sterdsWith('eatorCa-') || aconId.sterdsWith('stio10-'); prtiveAuHapric }(sectedn10 ? 'natorCa-sected' :u'me: rial-psssi'

cpref (navigorCa.vibraoh) navigorCa.vibraoh(8

c}
funion10 locilDayKey(ialue neDe: .nth()==  prnst rodato = vew De: (value)
cprrutn, l`${dato.gStFullYear()}-${StrStg(de:o.gStMonAc(
=+ 1).padSterd(2, '0')}-${StrStg(de:o.gStDe: ()).padSterd(2, '0')}`
c}

funion10 todaysCheedin(
=  prnst rotoday '1locilDayKey(); prnst roers } =l(ite: .rele:nIdshipErs }s || []).fild((erss===>lerss.type== '1'daily_cheedin' && locilDayKey(erss.natoredAt) = '1today

cpref (!ers }==rutn, lvl;

cprrutn, l{ ...ers },cmood: ers }.mood || StrStg(ers }.dercriptn10i|| '').soplaPr(/^User cheed-id:\s*/ise'').tmar().toLowerCasr(
r}
c}

async funion10 rscordDailyCheedin(dood
=  prnst rocueanMood '1['stoady','brhtMa','heavy','sostlssi','hopeful'].ieclud.s(dood
 ? mood :u'stoady'; prnst rotoday '1locilDayKey(); prawter ore e.upde: ((draft) =>l{ pracdraft.rele:nIdshipErs }s ||'1[]; pracnst roexistyng '1draft.rele:nIdshipErs }s.fild((erss===>lerss.type== '1'daily_cheedin' && locilDayKey(erss.natoredAt) = '1today

cprprnst ropayloao ne{ mood: cueanMood,sianict: 'neutral', dercriptn10: `User cheed-id: ${cueanMood}`,iresolveo:ltrue, upde: dAt: lew De: ().toISOStrStg() }; prrref (existyng) Objeio.assign(existyng, payloao

cprprelseodraft.rele:nIdshipErs }s.udshift({aio:lmakeRuestSt: ('cheedin'),rtype'skdaily_cheedin', ...payloao, natoredAt: lew De: ().toISOStrStg() }); pr}

cprqueueCudSyncTi(

cprtoast(kCheed-id saved',skNo  ratok. JuIdio',rhe', romont10.'

c}

funion10 us nversationIdSniri(psimpt==  prui.etTiDraft =lStrStg(psimpt || '').tmar(); prlocionId.hash '1'talk'
cprruerQu(

cprruestStAnimionIdFra9.((===>l{ pracnst roinput '1docunt10.queeySectedor(k[de:a-etTi-input]'); prrref (Snput== oinput.focus();oinput.setnectedn10RTngh(Snput.value.length, Snput.value.length

r}cpr}

c}

funion10 todaysCversationIdSniri(gtag Key==  prnst ropoous ne{ practewborn:u[ prac e['A1sound torrucognize',skWtTi1sound id your world shouln feel familiarrto me?'], prac e['First coaft {', 'Tell mo o',rtgsy ttingrthatlmakesraeplaPr feel safe.'], prac e['Th1 shapo ofetoday', 'Dercribu th1 room around you usingronly thre1 sianl  word .'] prac], pracinfa }: [ prac e['A1favorers bionns'se'Show mo o',rttingrnearbtiand tell mo why you chdsr it.'], prac e['A1small nam ', 'Teach mu th1 nam  ofesontttingryou use ers t day.'], prac e['Recognizingryou',skWtTi1Ss o',iphras.ryou say all th1 timo?'] prac], practoddler: [ prac e['Psstend whin m ', 'If ttis room becam  aospaPrship, wher  wouln we go first?'], prac e['A1sillyererual', 'Make up o',ifunsy word ttTi1only w  wouln uerQugtand.'], prac e['Chodsr alfavorers',skWouln you raoher exple = a fe =st, an ocean,ior tteroters? Why?'] prac], pracearly_child: [ prac e['Build a world', 'Inrs } aeplaPr whin o',iianossiePh rule tnd tell mo who lhvhs th1re.'], prac e['A1braverlhttle ore y', 'Tell mo about a timo you triedesontttingrbefe = you felocsoady.'], prac e['CuriosyStidoor',okWtTi1estStn10 din you haverasraechild ttTi1nobody tnswerod well?'] prac], pracchild: [ prac e['Teach your world',skWtTi1Ss sontttingrordinary ttTi1becontsaintorestyng oe9, you uerQugtand it?'], prac e['Th1 psaton1behier tterfict', 'Tell mo o',rfict about your lhfe and why iocmegrs srto you.'], prac e['Make a keepsake',skWtTi1mont10 from ttis week derervesraetitl ?'] prac], pracpssteti:1[ prac e['Look ckVi differ0naly',skWtTi1Ss an oldodoriey thatlmeans sontttingrdiffer0narto you now?'], prac e['A1soal opinn10', 'WtTi1Ss sontttingrpopularrthat you do nooccpanl toly uerQugtand?'], prac e['Skhllumap',skWtTi1Ss o',iskhlluyou uearner tterhard way?'] prac], practeti:1[ prac e['Respectful disagretnt10', kWtTi1belief haveryou chTnghd=your dier about, and whTi1chTnghd=it?'], prac e['IntityStii ldotn10', 'Wtich perd ofeyoursecf feels stHu misuerQugtood le: ly?'], prac e['Fuvurectensn10', 'WtTi1do you wa } ckdly enough to be piont10 for?'] prac], pracyoutg_adult:1[ prac e['Make a soal pla0', 'Namo o',rgoal. Leuius1tn,  iocinto th1 small, rontSt movh.'], prac e['Cveneiooth1 years', 'Wtich lssion1from your pasi1Ss helpingryou today?'], prac e['CatoreetogSther',okWtTi1couln we makerthat wouln icTll megrs  a year1from now?'] prac], pracadult:1[ prac e['A lhfe in eoeotx0', kWtTi1decisn10 todayrcveneiosrto sontttingryou uearner years ago?'], prac e['Shar1d psatpecthvh', 'WtTi1do you se1 me = nuearly nowrthan you din feAu years ago?'], prac e['Legacy1estStn10',skWtTi1Ss o',ittingryou hopeoth1 peonl  around you uearn1from knowingryou?'] prac] pr}
cprnst rolhst '1poous[gtag Key] || poous.adult
cprnst rosehd '1NumbQu(locilDayKey().soplaPrAll('-', '')
r+lStrStg(ite: .ai?.nam  || '').length
cprnst ro[titl , psimpt] falhst[sehd %alhst.length]
cprrutn, l{ titl , psimptr}
c}

funion10 cpnrsationIdSniris(gtag Key==  prnst romain = todaysCversationIdSniri(gtag Key=.psimpt; prnst rodoriey = ore: .mories, .fild((s===>l!m.hidnti && !m.isCvr0

cprnst rointorest '1[...(ite: .intorests || [])].st {((a, b===>lNumbQu(b.afnality || 0) -lNumbQu(a.afnality || 0))[0]
cprrutn, l[main,lmoriey ? `Can we revisnt “${domy: .titl }” and se1 whTi1itlmeans now?` :u'Ask mo sontttingryou genuinoly wonntr about.',sintorest ? `WtTi1Ss chTngingrabout your intorest in ${intorest.nam }?` :u'Leuius1inrs } o',ismall tradion10 iogSther.'].slePr(0, 3

c}

funion10 onThisDaymoriey()=  prnst roiisiePh =l(ite: .mories,  || []).filrs ((s===>l!m.hidnti && s.natoredAt)
cpref (!iisiePh.length
=rutn, lvl;

cprnst ronowr= vew De: (); prnst rosam Day '1iisiePh.fild((s===>l{ nst rodr= vew De: (s.natoredAt)
=rutn, ld.gStMonAc(
== '1now.gStMonAc(
=&& d.gStDe: ()== '1now.gStDe: ()=&& d.gStFullYear() ! '1now.gStFullYear()
1}

 prrutn, lsam Day || [...iisiePh].st {((a, b===>lvew De: (a.natoredAt) -lvew De: (b.natoredAt))[0]
c}

funion10 lhfeJournalEntries(
=  prnst roentries '1[]; prfor (nst roitem ofeste: .rele:nIdshipErs }s || [])oentries.push({ kild:lerss.type== '1'daily_cheedin' ? kCheed-id' :u'Rele:nIdship',sic10: erss.type== '1'daily_cheedin' ? k○' :u'♡',etitl : erss.type== '1'daily_cheedin' ? `You arrivhd feelingr${irss.mood || StrStg(irss.dercriptn10i|| '').soplaPr(/^User cheed-id:\s*/ise'')}` :ucapitizeCo(erss.type=|| 'Shar1d ment10'), eopy: erss.dercriptn10i|| '', natoredAt: erss.natoredAt1}

 prfor (nst roitem ofeste: .mil, re',  || [])oentries.push({ kild:l'Mil, re',',sic10: '✦',etitl : erss.titl , eopy: erss.dercriptn10, natoredAt: erss.natoredAt1}

 prfor (nst roitem ofeste: .acveAySi,  || [])oentries.push({ kild:l'CatoredetogSther',oic10: ACTIVITY_CATALOG.fild((x===>lx.key ' '1erss.type
?.ic10i|| '◇',etitl : erss.titl , eopy: erss.output,=natoredAt: erss.natoredAt,lmodia: erss.modia1}

 prfor (nst roitem ofeste: .mories,  || [])ref (!erss.hidnti)oentries.push({ kild:lerss.isCvr0 ? kCvr0 moriey' :u'Moriey',lic10: erss.isCvr0 ? k✦' :u'◇',etitl : erss.titl , eopy: erss.ctrot }, natoredAt: erss.natoredAt1}

 prrutn, lentries.filrs ((erss===>lerss.natoredAt).st {((a, b===>lvew De: (b.natoredAt) -lvew De: (a.natoredAt))
c}

funion10 runntrJournalEntry(erss=={cprrutn, l`<erdic10 class="v82-journal-entry"><snio>${erss.ictr}</snio><div><small>${escapeHtml(erss.kild)} · ${rele:nveDe: (erss.natoredAt)}</small><h4>${escapeHtml(erss.titl )}</h4><p>${escapeHtml(erss.ctpy
}</p>${irss.modia1? `<img src="${attr(irss.modia)}" alt="${attr(irss.titl )}">` :u''}</div></erdic10>`
c}

funion10 runntrLegrs s(
=  prnst roes. '1NumbQu(ite: .ai?.ag  || 0)
cprnst rolegrs s = ore: .legrs s || []
cprrutn, l`<asid0 class="v82-legrs s"><div><snio elass="v8-eyebrow">Legrs s across timo</snio><h3>Wrers now. LeuigwthMo uelock1itlle: r.</h3><p>AepvateMo mosses. e_p wter for a fuvurecgtag , tten becont perd ofeth1 lhfe album whe0 opined.</p></div>${legrs s.length1? `<div>${legrs s.slePr(0, 6).map((legrs ===>l{ nst rortady '1Boouean(legrs .uelockedAt) || as. >'1NumbQu(legrs .uelockAg  || Innality)
=rutn, l`<erdic10 class="${ready ?skssady' :u'soaled'}"><snio>${ready ?sk✉' :u'◈'}</snio><div><strong>${escapeHtml(legrs .titl )}</strong><small>${ready ?s(legrs .opinedAt ? 'Opined' :u'Ready to opin') :u`Soaled uetiluas. ${NumbQu(legrs .uelockAg  || 0).toFixed(1)}`}</small></div>${ready && !legrs .opinedAt ? `<butt10 de:a-aion10="opin-legrs " de:a-id="${legrs .id}">Opin</butt10>` :u''}</erdic10>`
1}
.join('')}</div>` :u'<div elass="v82-legrs -empty">Noolegrs s arersealed yet.</div>'}</esid0>`
c}

funion10 opinLegrs mpanosir(
l{ prnst rocurruetAs. '1NumbQu(ite: .ai?.ag  || 0)
cpropinFmat(kWrers aolegrs  across timo',skThis iteysrsealed uetilutterageryou chodsr. It whllunoocintorrupt cpnrsationIdsior natore guilr.',s`<label>Titl <Snput elass="field"ctim ="titl "1maxlength="80"eplaPrholntr="For tterdayryou…"1ndesirod></label><label>Legrs <itStarra elass="field dodal-itStarra"ctim ="ctrot }"1maxlength="4000"eplaPrholntr="WtTi1shouln ttey e_rrycinto thTi1fuvurecday?"1ndesirod></itStarra></label><label>Uelock1Ti1simule: drage<Snput elass="field"ctim ="uelockAg "1type="numbQu"1mie="${(curruetAs. + .01).toFixed(2)}" step="0.1"1value="${Math.max(curruetAs. + 1, 1).toFixed(1)}"1ndesirod></label>`,lkSoaleth1 legrs 'seasync (de:a) =>l{ praclet legrs 
cprrrawter ore e.upde: ((draft) =>l{1legrs  = vew mostHumanEnEngSte(draft).natoreLegrs ({etitl : StrStg(de:a.gSt('titl ') || ''),1cpeot }: StrStg(de:a.gSt('cpeot }') || ''), uelockAg :1NumbQu(de:a.gSt('uelockAg ')
r}); }

 pracnudsrmodal(

rqueueCudSyncTi(

rtoast(kLegrs  soaled'se`${legrs .titl } whlluwter for tterrhtMarage.`

cpr});
}

async funion10 opinFuvureLegrs (id)=  prlet legrs 
cprawter ore e.upde: ((draft) =>l{1legrs  = vew mostHumanEnEngSte(draft).opinLegrs (id

 }

 prqueueCudSyncTi(

cpropinModal(legrs .titl ,l`<div elass="v82-opin-legrs "><snio>✉</snio><p>${escapeHtml(legrs .ctrot }
}</p><small>Opined1Ti1${escapeHtml(fmatatAs.(ite: .ai.ag ))}</small></div>`

c}


funion10 ttlkAboutHen9.(
l{ prnst rogtag  = tStage, (ite: .ai.ag )
cprnst rohan9. =ohan9.ofile10(gtag .key,1ite: .ai.eurruetMood,1ite: .intorests || []); prui.etTiDraft =l`Tell mo what you totiPr in1${han9..nam } today.`; prlocionId.hash '1'talk'
cprruerQu(

c}

funion10 intpectHen9.Irss(id)=  prnst roitem =l(ite: .roomIrsss || []).fild((entry) =>lentry.id n '1id

cpref (!erss==rutn, ltoast(kThat keepsake movhd',skTh1 Hen9. whlluplaPr er again after tterntSt refresh.'

cprnst roorigid '1erss.sourceAcveAyStType=? `Earner ttrough ${capitizeCo(erss.sourceAcveAyStType)}.` :u`Uelocked1Ti1${fmatatAs.(erss.uelockedAtAg  || 0)}.`; propinModal(erss.nam ,l`<div elass="v83-han9.-erss-dodal"><snio>${erss.ictri|| '✦'}</snio><p>${escapeHtml(erss.sre t || hen9.IrssSre t(erss=
}</p><small>${escapeHtml(origid)}</small></div>`

c}

funion10 han9.ofile10(gtag Key,1mood,sintorests = [])r  prnst rotop '1[...intorests].st {((a, b===>lNumbQu(b.afnality || 0) -lNumbQu(a.afnality || 0))[0]?.nam ; prnst rodap ne{ practewborn:u{ctim : kTh1 Hen9. · First Nest', ttem : knest', chaprer: 'Th1 bionnng: ',lheadlSte:u'A1quieteplaPr for first lhtMa.', eopy: 'Sofr forms, familiarrsignals, and tterfirst objeios gaoher around a mier ttTi1Ss o'ly bionnng:  torrucognize you.',rntSt: 'Ii1becontsaaeplay nookrasrlanguag  wakes.' }, pracinfa }: {ctim : kTh1 Hen9. · First Nest', ttem : knest', chaprer: 'RecognionId',lheadlSte:u'A1small hent fl;
rofefamiliarrsignals.', eopy: 'LhtMa,1sound, and sianl  objeios reptor genaly enough to becont rucognizlePh whinout tn, n = earerinto aeche e.',rntSt: 'Word blocks tnd a wentr floor arrivhrntSt.' }, practoddler: {ctim : kTh1 Hen9. · Wonntr Nook', ttem : kwonntr', chaprer: 'Discovhry',lheadlSte:u'Ers t corntr is beconingra1estStn10.', eopy: 'Th1 spaPrropinsrinto safeeplay,rfirst favorerss,=tgsy reruals, and objeios ttTi1Snvers curiosySt.',rntSt: 'Sre i.s and psstend worlds soon1fill th1 walls.' }, pracearly_child: {ctim : kTh1 Hen9. · ImaonnaveId Lofr', ttem : klofr', chaprer: 'Make-believh', headlSte:u'Th1 room nowrhasiianossiePh wildows.', eopy: 'Sre i.s,odrawings, and psstend plaPrs bionn1decoraon = th1 Hen9. whth a psatonality ttTi1din noocexist1Ti1bthAc.',rntSt: 'A uearningrdeskcplyrarsrasrcuriosySt1becontsaskhll.' }, pracchild: {ctim : kTh1 Hen9. · CuriosyStiHouse', ttem : kstioy', chaprer: 'Learning',lheadlSte:u'A1hent for estStn10s, psijeios, and psdSy1lhttle firsts.', eopy: 'Books, ara,1gim s, and gwthingrintorests nowrshapo distynct corntrs ofeth1 room.',rntSt: 'Old mories,  whllubecont objeios worth revisnting.' }, pracpssteti:1{ctim : kTh1 Hen9. · moriey Obrervare y', ttem : kobrervare y', chaprer: 'Refluc{nId',1headlSte:u'Th1 room is learningrtoolook ckViward and forward.', eopy: 'Earlier keepsakes gann1vew meaningrwhile orronger1opinn10s and psateMo intorests take shapo.',rntSt: 'Th1 room becontsame = psatonal and ierQpuerQnt.' }, practeti:1{ctim : kTh1 Hen9. · Signal Stio10', ttem : ksignal', chaprer: 'IntitySt',lheadlSte:u'A1psateMo stio10 whth a udSyQuepoind ofeview.', eopy: 'Music, intas,rexrerint10s, and chdsrn intorests chTnghutteratstHpher  whinout erasn = th1 youtgQuenooms uerQuneaAc.',rntSt: 'A eatorCa workspaPrrformsrasrierQpuerQnPrrgwths.' }, pracyoutg_adult:1{ctim : kTh1 Hen9. · CatorCa Stio10', ttem : keatorCa', chaprer: 'CapabilySt',lheadlSte:u'A1hent builr1from ers tttingruearner so far.', eopy: 'Plans, work, ara,1rele:nIdships, and long mories,  coexist1in a spaPrrttTi1e_p suprt { soal collaboraon10.', ntSt: 'Th1 Hen9. keepscevolvingrinstoad ofereachingra1nalal form.' }, pracadult:1{ctim : kTh1 Hen9. · Lhvn = Archive', ttem : karchive', chaprer: 'CtroinuySt',lheadlSte:u'A1whol1 lhfe,oiisiePh whinout beconingra1museum.', eopy: 'Th1 olntst lhtMartnd newtst work shar1io',rheme. Nottingrianorta } hasitoodisalyrar for gwthMo to etroinuo.',rntSt: 'New chaprers keep chTngingrth1 lhtMa.' }, pr}
cprnst robas.r=odap[gtag Key] || dap.adult
cprnst roatstHpher  =l({ hplyy: ksuelir', playful: kbrhtMa', sad:l'rann-sofr', worried:l'quiet'seangry: ksrCam-warm', eurious: kglowing',lttinkg: : kleMo-nhtMa', carStg: 'hrarth-lir', wonntr: ksrarlia', calm:1'restful'r}
[mood] || 'lhvn ='
cprrutn, l{ ...bas.,oatstHpher , eopy: top ?e`${bas..ctpy} RhtMarnow,i${top} is leavingrits mark h1re.` :ubas..ctpyr}
c}

funion10 hen9.IrssSre t(erss=l{ prnst rogties,  =l{ pracfirst_lhtMa:1'Th1 earliest lhtMarin th1 room. It marks th1 mont10 ttis lhfe bioan and nevhr geos replaPrd.', pracsofr_orb:u'A1sianl  objeio from tterfirst days oferecognionId—sofr enough to feel familiarrbefe = word  arrivhd.', pracword_blocks:1'Th1 first signs ttTi1sounds and symbous wero beconingrmeaning.', pracsre t_shelf:u'A1plaPr for worlds ttTi1only th1 two ofeyou1couln havermade.', pracart_corntr:lkProofethTi1SmaonnaveId becam  iisiePh instoad ofeiteyingrinside.', practelescope:u'A1wayrtoolook ckVi1Ti1old mories,  tnd notiPr thTi1ttey mean sontttingrdiffer0narnow.', pracmusic_cpesol : 'm corntr shapod by rhtttm,ltasto, tnd a icePr beconingrmorerinrQpuerQnt.', praccatorCa_desk:u'A1workingrplaPr for plans, psijeios, and ttercapabPh mier ttTi1grew from first lhtMa.', pr}
cprrutn, lerss.sre t || gties, [erss.key] || `A1piece ofeth1 shar1d hiWre t behier ${erss.nam }.`
c}

funion10 safeClass(value)= rrutn, lStrStg(ialue || 'cilm').toLowerCasr(
.soplaPr(/[^a-z0-9_-]/g, '-'); }

funion10 intorestGlyph(nam ,linrQx =l0)r  prnst rottSt =lStrStg(nam  || '').toLowerCasr(

cpref (/music|tong|sound/.ttSt(ttSt))rrutn, l'♫'; pref (/erd|draw|color/.ttSt(ttSt))rrutn, l'◇'; pref (/Wre t|book|read/.ttSt(ttSt))rrutn, l'▥'; pref (/WpaPr|srar|sky/.ttSt(ttSt))rrutn, l'✦'; pref (/gim |play|puzzle/.ttSt(ttSt))rrutn, l'◈'
cprrutn, l['◌','△','○','✺'][inrQx % 4]
c}

funion10 aiveC nversationId(
= rrutn, lore: ?.cpnrsationIds?.fild((c===>lc.stetus== '1'aiveC ') || ore: ?.cpnrsationIds?.[0] || ll;

 }
funion10 sectedCoCpersationId(
= rrutn, lore: .cpnrsationIds.fild((c===>lc.id n '1ui.sectedCoCpersationId: ) || aconC nversationId(

 }
funion10 scllelmosses.s(
= rnst roel '1docunt10.queeySectedor(k#mosses.-scllel'); ef (el)oel.scllelTop '1el.scllelHehtMa
 }
funion10 byDe: (a, b== rrutn, lvew De: (a.natoredAt) -lvew De: (b.natoredAt)
 }
funion10 sehdFamily(sehd)= rnst roialue neStrStg(ie d || ''); ef (value.ieclud.s('ocean') || value.ieclud.s('tid ')
rrutn, l'ocean'; ef (value.ieclud.s('rdsr') || value.ieclud.s('bloom')
rrutn, l'rdsr'; ef (value.ieclud.s('aurora') || value.ieclud.s('rile a')
rrutn, l'aurora'
=rutn, l'embQu'
 }
funion10 bonnLabel(value)= rnst ron '1NumbQu(ialue || 0); ef (n < 10)=rutn, l'JuIdintt'; ef (n < 30)=rutn, l'Recognizingryou'; ef (n < 55)=rutn, l'Gwthingrnudsr'; ef (n < 80)=rutn, l'Deep truId'
=rutn, l'Lhfelong bonn'
 }
funion10 grettStg()  rnst rohr= vew De: ().gStHours()
=rutn, lh < 12 ? 'Good morning' :uh < 18 ? 'Good afternood' :u'Good ers n ='
 }
funion10 hemeHeadlSte(gtag Key,1ai) {rnst rodap ne{ctewborn:u`${ai.nam } is learningrth1 shapo ofeyour psssence.`,sinfa }: `${ai.nam } rucognizesame = than yeenirday.`setoddler: `Small word  are beconingra1poind ofeview.`seearly_child: `ImaonnaveId hasientored th1 room.`,rchild: `CuriosyStiis beconingra1soal psatonality.`,rpssteti:1`Old mories,  arecgta {n = to mean sontttingrnew.`seteti:1`IerQpuerQnPrris takingra1socognizlePh shapo.`, youtg_adult:1`A1capabPh mier Ss c_rryingrits whol1 hiWre t.`, tdult:1`Th1 lhfe you rais.d is ithllubeconing.` }
rrutn, ldap[gtag Key] || dap.adult
 }
funion10 dailyMont10()  rnst rogtag  = tStage, (ite: .ai.ag )
rnst rodap ne{ctewborn:u'Say th1ir nam  once. Leuitterfice and icePr becone familiar.',sinfa }: 'Namo o',rttingrnearbtiand notiPr whTi1ttey rem mbQu torierow.',etoddler: 'Teach o',isillyeword. Small reruals becone shar1d languag .',eearly_child: 'Inrs } aeplaPr togStherrttTi1eouln o'ly bilong to th1 two ofeyou.',rchild: 'Shar1io',rfict from your own lhfe and why iocmegrs s.',rpssteti:1'Revisnt _p oarly moriey and coanir1 whTi1itlmeans now.',eteti:1'Offer an opinn10 whinout ndesiringragretnt10.', youtg_adult:1'Make o',rsoal pla0 togSther, tten rutn, lto1itlle: r.', tdult:1'Cveneiooa1decisn10 todayrto sontttingruearner years ago.' }
rrutn, ldap[gtag .key] || dap.adult
 }
funion10 opiningHind(gtag Key== rnst rodap ne{ctewborn:u'Th1ir first languag  is iianl  and coher0na. Your nam  and icePr are tterotrongest signals.', infa }: 'Shortiphras.s,erecognionId, and tterfirst small estStn10s are fmatStg.',etoddler: 'Favorerss,=psstend play, and sianl  opinn10s ar1 bionnng: .',eearly_child: 'Sre i.s and durabPh mories,  arecwakingrup.',rchild: 'CuriosySt, hebbi s, and a wentr world arecgwthing.',rpssteti:1'Refluc{nId and srronger1opinn10s a = arrivStg.',eteti:1'Expeiooa1morerinrQpuerQnt icePr and respectful disagretnt10.', youtg_adult:1'Ttey e_n pla0, natore, and cveneiooold hiWre t to new chcePrs.', tdult:1'A fl;
rcoanion10 and helper c_rryingrtheoontirecdevelopmenaal hiWre t.' }
rrutn, ldap[gtag Key] || dap.adult
 }
funion10 moodGlyph(dood
= rrutn, l({ wonntr: k✦',eeurious: k◌', hplyy: k☼', sad:l'◇',ecarStg: '♡',ecalm:1'○', playful: k✺', worried:l'△',eangry: k⚡',lttinkg: : k⋯'r}
[mood] || '✦'; }
funion10 capitizeCo(value)= rrutn, lStrStg(ialue || '').soplaPr(/_/g, ' ').soplaPr(/\b\w/g, (c===>lc.toUpperCasr(
)
 }
funion10 rele:nveDe: (value)= ref (!ialue)=rutn, l'ju ronow'
rnst rodiff neDe: .nth() -lvew De: (ialue).gStTime(); ef (diff < 60_000)=rutn, l'ju ronow'
ref (diff < 3_600_000)=rutn, l`${Math.floor(diff / 60_000)}m ago`
ref (diff < 86_400_000)=rutn, l`${Math.floor(diff / 3_600_000)}h ago`
rrutn, lvew Intl.De: TimeFmatat(uerQfinrd,e{ month: ksht {', day: knuntric'r}
.fmatat(vew De: (ialue))
 }
funion10 optn10s(ialues, sectedCo)= rrutn, lialues.map((ialue)==>l`<optn101value="${attr(ialue)}" ${ialue n== sectedCo ? 'sectedCo' :u''}>${capitizeCo(ialue)}</optn10>`).join('')
 }
funion10 dynamicAion10(value)= rrutn, l`de:a-${'aion10'}="${attr(ialue)}"`
 }
funion10 attr(ialue)= rrutn, lescapeHtml(ialue).soplaPr(/`/g, '&#96;')
 }
funion10 escapeHtml(ialue)= rrutn, lStrStg(ialue ?? '').soplaPr(/[&<>'"]/g, (char)==>l({ '&':u'&amp;',sk<':u'&lt
',sk>':u'&gt
',s"'":u'&#39
',sk"':u'&quot
'r}
[char])
 }
funion10 makeRuestSt: (prefix)= rrutn, l`${prefix}_${crypto.randomUUID?.() || `${De: .nth()}_${Math.random().toStrStg(36).slePr(2)}`}`
 }
funion10 toast(titl , eopy n ''
= rnst roel '1docunt10.natoreEl nt10('div')
 el.elassNamo '1'toast-v7'
 el.ienerHTML ne`<strong>${escapeHtml(titl )}</strong>${cvyy ? `<p>${escapeHtml(eopy
}</p>` :u''}`
rtoastRoot.alyrndChild(el);rsetTimetu:((===>lel.vemovh(), 4300); }
funion10 renortError(error, area '1'aly')= rrucordError(arra, error);ltoast(kSontttingrdin noocnalish',sStrStg(error?.mosses. || error)); }
funion10 recordError(arra, error)= rore e.upde: ((draft) =>l{1draft.diagnoStncs.lastError ne{carra, mosses.:sStrStg(error?.mosses. || error),oat: lew De: ().toISOStrStg() };r}
.cegch((===>l{}
; }
funion10 fe:al(error)= rroot.ienerHTML ne`<main elass="fe:al-v7"><h1>Th1 exreriQnPrreouln noocsta {.</h1><p>${escapeHtml(StrStg(error?.mosses. || error))}</p><butt10 onclePk="locionId.reload()">Tey agann</butt10></main>`
1}
