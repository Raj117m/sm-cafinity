import {useEffect,useRef,useState} from 'react';
import {Sparkles} from 'lucide-react';
import type {Product} from './types';
import {money} from './api';

export function PairSnack({source,target,quantity,disabled,add}:{source:Product;target:Product;quantity:number;disabled:boolean;add:()=>void}) {
  const [dismissed,setDismissed]=useState(false);
  const ref=useRef<HTMLElement>(null);
  const [closing,setClosing]=useState(false);
  useEffect(()=>{
    if(dismissed)return;
    const timer=setTimeout(()=>{
      const node=ref.current;
      if(!node||!node.getClientRects().length)return;
      const dialog=node.closest('dialog');
      if(!dialog&&document.querySelector('dialog[open]'))return;
      node.scrollIntoView?.({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
    },1000);
    return()=>clearTimeout(timer);
  },[dismissed]);
  useEffect(()=>{if(!closing)return;const timer=setTimeout(()=>setDismissed(true),220);return()=>clearTimeout(timer);},[closing]);
  if(dismissed||!target.orderable||target.id===source.id)return null;
  return <aside ref={ref} className={`inline-pair ${closing?'pair-closing':''}`} aria-label={`Pairing for ${source.name}`}>
    <img src={target.image} alt="" loading="lazy"/>
    <div><small>A LITTLE SOMETHING ALONGSIDE</small><b>{target.name}</b><p>{source.pairing_reason}</p></div>
    <button disabled={disabled} onClick={add} aria-label={`Add paired ${target.name}`}>{quantity>0?`${quantity} added · +`:`+ ${money(target.price)}`}</button>
    <button className="pair-dismiss" aria-label={`Dismiss pairing for ${source.name}`} onClick={()=>setClosing(true)}>× Close suggestion</button>
  </aside>;
}

export function MenuProduct({product:p,quantity,disabled,add,customize,children}:{product:Product;quantity:number;disabled:boolean;add:()=>void;customize:()=>void;children:React.ReactNode}) {
  const [revealed,setRevealed]=useState(false);
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=ref.current;if(!node||typeof IntersectionObserver==='undefined')return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const observer=new IntersectionObserver(([entry])=>{
      clearTimeout(timer);
      if(entry.isIntersecting&&entry.intersectionRatio>=.7)timer=setTimeout(()=>{setRevealed(true);observer.disconnect();},3000);
    },{threshold:[0,.7]});
    observer.observe(node);
    return()=>{clearTimeout(timer);observer.disconnect();};
  },[]);
  return <><div ref={ref} className={`menu-product-row ${revealed?'title-settled':''}`}>
    <button className="menu-product-image" onClick={customize} aria-label={`View ${p.name}`}><img src={p.image} alt="" loading="lazy"/></button>
    <h3 className="travelling-title">
      {p.name}
      {p.surplus_boost && <span className="surplus-badge" title="Chef's fresh surplus feature"><Sparkles size={10} /> Chef's Feature</span>}
    </h3>
    <div className="menu-product-description"><p>{p.description}</p><div className="menu-price">{p.compare_at_price&&<del>{money(p.compare_at_price)}</del>}<strong>{money(p.price)}</strong></div></div>
    <div className="menu-product-actions">
      {p.options.length>0&&<button className="customize-link" onClick={customize} disabled={disabled}>Customize</button>}
      <button className="quick-add" aria-label={`Add ${p.name}`} disabled={disabled||!p.orderable} onClick={add}>{!p.orderable?'Sold out':quantity>0?<><b>{quantity}</b> added <span>+</span></>:<>Add <span>+</span></>}</button>
    </div>
  </div>{children}</>;
}
