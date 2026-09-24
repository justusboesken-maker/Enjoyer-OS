/* Rechenkern der Web-App. Grundlage: Referenzimplementierung aus docs/uebergabe.md, Anhang B.
   Abweichungen von der Vorlage sind mit [App] markiert: nicht zugeordnetes Cash (O-5) in rebalance,
   offener Grenzsteuersatz (O-4) in tax23, optionale Orders unter dem Mindestbetrag (O-8). */
/* ===== Regel-Engine: Serien, Regeln, Depot (FIFO), Steuern, Rebalancing ===== */
var ENG = (function(){
  var DAY = 864e5;
  function iso(t){ return new Date(t).toISOString().slice(0,10); }
  function addDays(d,n){ return iso(new Date(d+'T00:00:00Z').getTime()+n*DAY); }
  function mondayOf(d){ var dt=new Date(d+'T00:00:00Z'); var dow=(dt.getUTCDay()+6)%7; return iso(dt.getTime()-dow*DAY); }
  function daysBetween(a,b){ return Math.round((new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/DAY); }
  /* Ende der Jahresfrist (§ 23): gleicher Kalendertag im Folgejahr; 29.02. -> 28.02. */
  function oneYearAfter(d){ var y=+d.slice(0,4)+1, md=d.slice(5); if(md==='02-29') md='02-28'; return y+'-'+md; }
  function isLongTerm(buy, sell){ return sell > oneYearAfter(buy); }
  function taxFreeFrom(buy){ return addDays(oneYearAfter(buy),1); }

  /* eingebettete Historie: {k0, s(scale), c:"int,int,..", o:"4444.."(Wochentag-Offset des Schlusses ab Montag)} */
  function decodeHist(H){
    var cs=H.c.split(','), k=[], d=[], c=[], t0=new Date(H.k0+'T00:00:00Z').getTime();
    for(var i=0;i<cs.length;i++){ var key=iso(t0+i*7*DAY); k.push(key); d.push(addDays(key, H.o ? +H.o.charAt(i) : H.off)); c.push(+cs[i]/H.s); }
    return {k:k, d:d, c:c};
  }

  /* Wochenpunkte aus der Datenbank einmischen. p = Vorwochenschluss auf aktueller Basis:
     bei bereinigten Kursen (FTSE) wird die ältere Historie mit p/alt skaliert (Ausschüttungen),
     sonst wird der Vorwochenwert korrigiert. */
  function merge(hist, docs, rescale){
    var map={}, i;
    for(i=0;i<hist.k.length;i++) map[hist.k[i]]={d:hist.d[i], c:hist.c[i]};
    (docs||[]).filter(function(w){ return w && w.k && w.c>0; }).sort(function(a,b){ return a.k<b.k?-1:a.k>b.k?1:0; }).forEach(function(w){
      var pk=addDays(w.k,-7);
      if(w.p>0 && map[pk]){
        var r=w.p/map[pk].c;
        if(Math.abs(r-1)>1e-9){
          if(rescale){ for(var key in map){ if(key<w.k) map[key].c*=r; } }
          else map[pk].c=w.p;
        }
      }
      map[w.k]={d:w.d||addDays(w.k,4), c:w.c};
    });
    var ks=Object.keys(map).sort();
    return {k:ks, d:ks.map(function(x){return map[x].d;}), c:ks.map(function(x){return map[x].c;})};
  }

  /* Regel über die ganze Serie. rule: {type:'confirm', n} oder {type:'band', p} */
  function evalRule(S, rule){
    var n=S.c.length, sma=new Array(n), st=new Array(n), up=new Array(n), dn=new Array(n), sum=0, i;
    for(i=0;i<n;i++){ sum+=S.c[i]; if(i>=50) sum-=S.c[i-50]; sma[i]= i>=49 ? sum/50 : null; }
    var s=null, u=0, dw=0, sw=[];
    for(i=0;i<n;i++){
      if(sma[i]==null){ st[i]=null; up[i]=0; dn[i]=0; continue; }
      var c=S.c[i], M=sma[i];
      if(c>M){u++; dw=0;} else if(c<M){dw++; u=0;} else {u=0; dw=0;}
      var prev=s;
      if(rule.type==='band'){ if(s===null) s=c>M?1:0; else if(s===0&&c>M*(1+rule.p)) s=1; else if(s===1&&c<M*(1-rule.p)) s=0; }
      else { if(s===null) s=c>M?1:0; else if(s===0&&u>=rule.n) s=1; else if(s===1&&dw>=rule.n) s=0; }
      st[i]=s; up[i]=u; dn[i]=dw;
      if(prev!==null && prev!==s) sw.push({i:i, k:S.k[i], d:S.d[i], to:s, c:c, m:M});
    }
    var L=n-1, S49=0; for(i=n-49;i<n;i++) S49+=S.c[i];
    var p=rule.type==='band'?rule.p:0.03;
    var lastSw=sw.length?sw[sw.length-1]:null;
    return {sma:sma, st:st, up:up, dn:dn, sw:sw,
      last:{i:L, k:S.k[L], d:S.d[L], c:S.c[L], m:sma[L], dist:S.c[L]/sma[L]-1, st:st[L], up:up[L], dn:dn[L],
            changed: L>0 && st[L-1]!=null && st[L-1]!==st[L], lastSwitch:lastSw},
      next:{above:S49/49, bandUp:(1+p)*S49/(49-p), bandDown:(1-p)*S49/(49+p)}};
  }

  /* Buchungen -> FIFO-Bestände und realisierte Gewinne */
  function book(tx){
    var pos={ftse:[], btc:[], gold:[]}, real=[];
    (tx||[]).slice().sort(function(a,b){ return a.d<b.d?-1:a.d>b.d?1:((a.ts||0)-(b.ts||0)); }).forEach(function(t){
      if(!pos[t.a] || !(t.units>0)) return;
      if(t.type==='kauf'){ pos[t.a].push({d:t.d, units:t.units, cpu:(t.units*t.price+(t.fee||0))/t.units, id:t.id, est:!!t.est}); }
      else if(t.type==='verkauf'){
        var left=t.units, per=(t.units*t.price-(t.fee||0))/t.units, cost=0, sg=0, lg=0;
        while(left>1e-12 && pos[t.a].length){
          var lot=pos[t.a][0], q=Math.min(left, lot.units), g=q*(per-lot.cpu);
          cost+=q*lot.cpu; if(isLongTerm(lot.d, t.d)) lg+=g; else sg+=g;
          lot.units-=q; left-=q; if(lot.units<=1e-12) pos[t.a].shift();
        }
        real.push({a:t.a, d:t.d, units:t.units, proceeds:t.units*per, cost:cost, gain:t.units*per-cost, shortGain:sg, longGain:lg, open:left, id:t.id});
      }
    });
    return {pos:pos, real:real};
  }
  function units(lots){ return lots.reduce(function(s,l){return s+l.units;},0); }
  function cost(lots){ return lots.reduce(function(s,l){return s+l.units*l.cpu;},0); }

  /* Steuerlage des Jahres aus Einstellungen + erfassten Verkäufen */
  function taxYear(cfg, real, year){
    var r20=0, r23=0;
    (real||[]).forEach(function(r){
      if(r.d.slice(0,4)!==String(year)) return;
      if(r.a==='ftse'){ if(!cfg.pbUsedDate || r.d>cfg.pbUsedDate) r20+=r.gain*(1-cfg.tfs); }
      else r23+=r.shortGain;
    });
    var pbFree=(cfg.pb||0)-(cfg.pbUsed||0)-(cfg.interestRest||0)-r20+(cfg.lossOther||0);
    var s23Before=(cfg.s23Other||0)+r23;
    return {pbFree:pbFree, r20:r20, r23:r23, s23Before:s23Before};
  }
  /* [App] Grenzsteuersatz offen (O-4): Steuer über der Freigrenze ist dann unbekannt (NaN) */
  function tax23(x, cfg){ return x>=cfg.fg ? (typeof cfg.rate==='number' && isFinite(cfg.rate) ? x*cfg.rate : NaN) : 0; }

  /* FIFO-Verkauf simulieren: wie viel Wert v bringt welchen Gewinn */
  function simSell(lots, v, px, date, a, cfg){
    var q=v/px, left=q, g20=0, sg=0, lg=0, parts=[];
    for(var i=0;i<lots.length && left>1e-12;i++){
      var l=lots[i], take=Math.min(left,l.units), g=take*(px-l.cpu);
      parts.push({d:l.d, q:take, g:g, long: a!=='ftse' && isLongTerm(l.d,date)});
      if(a==='ftse') g20+=g; else if(isLongTerm(l.d,date)) lg+=g; else sg+=g;
      left-=take;
    }
    return {q:q, g20:g20, taxable20:g20*(1-cfg.tfs), sg:sg, lg:lg, parts:parts};
  }
  /* größter steuerfreier Verkaufswert (FIFO, ohne Lose zu überspringen) */
  function taxFreeMax(lots, px, date, a, cfg, ty){
    var val=0;
    if(a==='ftse'){
      var room=Math.max(0, ty.pbFree);
      for(var i=0;i<lots.length;i++){ var l=lots[i], gpu=(px-l.cpu)*(1-cfg.tfs);
        if(gpu<=0){ val+=l.units*px; room+=-gpu*l.units; continue; }
        var q=Math.min(l.units, room/gpu); val+=q*px; room-=q*gpu; if(q<l.units-1e-12) break; }
      return val;
    }
    var limit=cfg.fg-(cfg.buffer||0)-0.01, acc=ty.s23Before; /* Freigrenze: Summe muss unter 1.000 € bleiben */
    for(var j=0;j<lots.length;j++){ var L=lots[j];
      if(isLongTerm(L.d,date)){ val+=L.units*px; continue; }
      var g=px-L.cpu;
      if(g<=0){ val+=L.units*px; acc+=g*L.units; continue; }
      var roomS=limit-acc; if(roomS<=0) break;
      var qq=Math.min(L.units, roomS/g); val+=qq*px; acc+=qq*g; if(qq<L.units-1e-12) break; }
    return val;
  }

  /* Rebalancing. o: {date, w, st, px, pos, cash, cashFree, cfg, ty, variant}
     [App] cashFree = Cash, das noch keinem Baustein zugeordnet ist (O-5). Es zählt zum Gesamtwert
     und wird wie Cash eines Bausteins mit Ziel 0 vollständig verteilt. Für B-12 ergibt das dieselben
     Orders wie die Zuordnung des ganzen Cashs zum Gold-Baustein. */
  function rebalance(o){
    var A=['ftse','btc','gold'], cfg=o.cfg, ty=o.ty, rows={}, T=0, free=Math.max(0, o.cashFree||0);
    A.forEach(function(a){
      var lots=o.pos[a]||[], u=units(lots), V=u*(o.px[a]||0), C=o.cash[a]||0;
      rows[a]={a:a, st:o.st[a], units:u, V:V, C:C, S:V+C, sell:0, buy:0, cashTo:0, ruleSale:false, g20:0, t20:0, sg:0, lg:0};
      T+=V+C;
    });
    T+=free;
    A.forEach(function(a){ rows[a].G=T*o.w[a]; });
    /* Regel-Verkauf: Position laut Regel draußen, aber noch gehalten */
    A.forEach(function(a){ var r=rows[a]; if(r.st===0 && r.V>0){ r.ruleSale=true; r.sell=r.V; } });
    var supply=free, demand=0;
    A.forEach(function(a){
      var r=rows[a], desired=r.S-r.G;
      if(desired>0){
        var fromCash=Math.min(desired, r.C + (r.ruleSale? r.V:0));
        var rest=desired-fromCash;
        if(r.st===1 && rest>0){
          var cap = o.variant==='frei' ? taxFreeMax(o.pos[a], o.px[a], o.date, a, cfg, ty) : Infinity;
          r.sellWanted=rest; r.sell=Math.min(rest, cap); r.capped=r.sell<rest-0.5;
        }
        r.give=fromCash+(r.st===1? r.sell:0);
        supply+=r.give;
        if(r.st===1) r.buyOwn=Math.max(0, r.C-fromCash); /* Rest-Cash der Position investieren */
      } else {
        r.want=-desired; demand+=r.want;
        if(r.st===1) r.buyOwn=r.C;
      }
    });
    var f = demand>0 ? Math.min(1, supply/demand) : 0;
    A.forEach(function(a){
      var r=rows[a];
      if(r.want){ r.get=r.want*f; if(r.st===1) r.buy=(r.buyOwn||0)+r.get; else r.cashTo=r.get; }
      else if(r.st===1 && r.buyOwn) r.buy=r.buyOwn;
      if(r.st===0 && !r.want){ r.cashTo=-(r.give||0) + (r.ruleSale? r.V:0); }
      if(r.sell>0){ var sm=simSell(o.pos[a], r.sell, o.px[a], o.date, a, cfg); r.sellUnits=sm.q; r.g20=sm.g20; r.t20=sm.taxable20; r.sg=sm.sg; r.lg=sm.lg; }
      if(r.buy>0) r.buyUnits = o.px[a]>0 ? r.buy/o.px[a] : null; /* [App] ohne Kurs keine Stückzahl */
      r.after = r.st===1 ? (r.V - r.sell + r.buy) : (r.C + (r.ruleSale? r.V:0) + (r.want? r.get : -(r.give||0)));
    });
    /* Steuern */
    var new20=A.reduce(function(s,a){return s+rows[a].t20;},0);
    var free20=Math.max(0, ty.pbFree);
    var tax20 = Math.max(0, new20 - free20) * cfg.abg;
    var sgNew=A.reduce(function(s,a){return s+(a==='ftse'?0:rows[a].sg);},0);
    var tax23v = tax23(ty.s23Before+sgNew, cfg) - tax23(ty.s23Before, cfg);
    var orders=A.reduce(function(s,a){return s+(rows[a].sell>0.5?1:0)+(rows[a].buy>0.5?1:0);},0);
    var afterT=A.reduce(function(s,a){return s+rows[a].after;},0);
    A.forEach(function(a){ rows[a].wAfter = afterT>0 ? rows[a].after/afterT : 0; });
    /* [App] Orders unter dem Mindestbetrag (O-8, ohne Vorgabe) als optional markieren */
    A.forEach(function(a){ var r=rows[a], m=cfg.minOrder;
      r.sellOptional = m>0 && r.sell>0.5 && !r.ruleSale && r.sell<m;
      r.buyOptional = m>0 && r.buy>0.5 && r.buy<m; });
    return {rows:rows, T:T, cashFree:free, tax20:tax20, tax23:tax23v, tax:tax20+tax23v, new20:new20, free20:free20, s23After:ty.s23Before+sgNew, orders:orders, fees:orders*(cfg.fee||0), fill:f,
            pbLeft: Math.max(0, free20-new20)};
  }

  /* Vorabpauschale des Jahres (fällig im Januar des Folgejahres) für die FTSE-Lose */
  function vorab(lots, year, p0, pEnd, basiszins){
    if(!(p0>0) || !(pEnd>p0)) return 0;
    var vp=0;
    lots.forEach(function(l){
      var y=+l.d.slice(0,4), m=+l.d.slice(5,7);
      var f = y<year ? 1 : (y===year ? (13-m)/12 : 0);
      var base = l.units*p0*basiszins*0.7*f;
      vp += Math.min(base, l.units*(pEnd-p0));
    });
    return vp;
  }

  return {iso:iso, addDays:addDays, mondayOf:mondayOf, daysBetween:daysBetween, oneYearAfter:oneYearAfter, isLongTerm:isLongTerm, taxFreeFrom:taxFreeFrom,
          decodeHist:decodeHist, merge:merge, evalRule:evalRule, book:book, units:units, cost:cost, taxYear:taxYear, tax23:tax23,
          simSell:simSell, taxFreeMax:taxFreeMax, rebalance:rebalance, vorab:vorab};
})();
if(typeof module!=='undefined') module.exports=ENG;
