function syntaxHL(code, lang) {
  lang = lang || '';
  var esc = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var jsLangs = ['ts','tsx','js','jsx','typescript','javascript'];
  if (jsLangs.indexOf(lang) !== -1) {
    var src = esc, out = '', i = 0;
    var KWS = 'const,let,var,function,class,return,import,export,from,if,else,for,while,async,await,new,typeof,interface,type,extends,implements,null,undefined,true,false,void,enum,readonly,public,private,protected,static,abstract'.split(',');
    while (i < src.length) {
      var ch = src[i];
      if (ch==='/' && src[i+1]==='/') {
        var e1=src.indexOf('\n',i); if(e1<0) e1=src.length;
        out+='<span class="t-cmt">'+src.slice(i,e1)+'</span>'; i=e1; continue;
      }
      if (ch==='/' && src[i+1]==='*') {
        var e2=src.indexOf('*/',i+2); if(e2<0) e2=src.length-2;
        out+='<span class="t-cmt">'+src.slice(i,e2+2)+'</span>'; i=e2+2; continue;
      }
      if (ch==='"') {
        var j=i+1; while(j<src.length && src[j]!=='"'){if(src[j]==='\\'){j+=2;}else{j++;}} j++;
        out+='<span class="t-str">'+src.slice(i,j)+'</span>'; i=j; continue;
      }
      if (ch==="'") {
        var k=i+1; while(k<src.length && src[k]!=="'"){if(src[k]==='\\'){k+=2;}else{k++;}} k++;
        out+='<span class="t-str">'+src.slice(i,k)+'</span>'; i=k; continue;
      }
      var prev = i>0 && /[a-zA-Z0-9_$]/.test(src[i-1]);
      if (!prev && /[a-zA-Z_$]/.test(ch)) {
        var m=i; while(m<src.length && /[a-zA-Z0-9_$]/.test(src[m])) m++;
        var next = m<src.length && /[a-zA-Z0-9_$]/.test(src[m]);
        var word=src.slice(i,m);
        if (!next && KWS.indexOf(word)!==-1) { out+='<span class="t-kw">'+word+'</span>'; i=m; continue; }
        if (!next && /^[A-Z]/.test(word)) { out+='<span class="t-type">'+word+'</span>'; i=m; continue; }
        out+=word; i=m; continue;
      }
      if (/[0-9]/.test(ch) && (i===0||!/[a-zA-Z_$]/.test(src[i-1]))) {
        var n=i; while(n<src.length && /[0-9.]/.test(src[n])) n++;
        out+='<span class="t-num">'+src.slice(i,n)+'</span>'; i=n; continue;
      }
      out+=ch; i++;
    }
    return out;
  }
  if (lang==='json') {
    return esc
      .replace(/"([^"\\]|\\.)*"(\s*):/g,function(m){var ci=m.lastIndexOf('"')+1;return '<span class="t-prop">'+m.slice(0,ci)+'</span>'+m.slice(ci);})
      .replace(/"([^"\\]|\\.)*"/g,function(m){return '<span class="t-str">'+m+'</span>';})
      .replace(/\b(true|false|null)\b/g,'<span class="t-kw">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g,'<span class="t-num">$1</span>');
  }
  return esc;
}
