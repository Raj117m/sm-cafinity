import {useEffect,useRef,useState} from 'react';
import {money} from './api';

export function CoinWheel({value,max,balance,coinValue,disabled,onChange}:{value:number;max:number;balance:number;coinValue:number;disabled:boolean;onChange:(n:number)=>void}){
  const ref=useRef<HTMLDivElement>(null);
  const limit=Math.max(0,Math.floor(max));
  const selected=Math.min(limit,Math.max(0,value));
  const [position,setPosition]=useState(selected);
  const center=Math.min(limit,Math.max(0,Math.round(position)));
  useEffect(()=>{
    if(value!==selected&&!disabled)onChange(selected);
    const node=ref.current;
    if(node&&Math.round(node.scrollTop/40)!==selected){node.scrollTop=selected*40;setPosition(selected);}
  },[selected,value,disabled,onChange]);
  const choose=(n:number)=>{if(disabled)return;const next=Math.max(0,Math.min(limit,n));onChange(next);if(ref.current)ref.current.scrollTop=next*40;setPosition(next);};
  const first=Math.max(0,center-8),last=Math.min(limit,center+8);
  return <section className="coin-picker" aria-label="Coin discount">
    <div className="coin-picker-heading"><div><small>YOUR ATOMZ COINS</small><h3>A little off your bill.</h3></div><span>{balance} available</span></div>
    <div className="coin-picker-body">
      <div className={`coin-wheel-shell ${disabled?'is-disabled':''}`}>
        <div className="coin-wheel-highlight" aria-hidden="true"/>
        <div ref={ref} className="coin-wheel" role="spinbutton" aria-label="Coins to redeem" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={selected} aria-valuetext={`${selected} coins, ${money(selected*coinValue)} discount`} aria-disabled={disabled} tabIndex={disabled?-1:0}
          onKeyDown={e=>{if(['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)){e.preventDefault();choose(e.key==='Home'?0:e.key==='End'?limit:selected+({ArrowUp:1,ArrowDown:-1,PageUp:10,PageDown:-10}[e.key]||0));}}}
          onScroll={e=>{const offset=Math.max(0,Math.min(limit,e.currentTarget.scrollTop/40));const n=Math.round(offset);setPosition(offset);if(!disabled&&n!==selected)onChange(n);}}>
          <div style={{height:(limit+1)*40+120,position:'relative'}}>
            {Array.from({length:last-first+1},(_,i)=>first+i).map(n=>{
              const distance=n-position;
              const angle=Math.max(-1.4,Math.min(1.4,distance*.47));
              return <div key={n} className={`coin-wheel-option ${n===selected?'selected':''}`} style={{top:60+n*40}} aria-hidden="true" onClick={()=>choose(n)}>
                <div className="coin-wheel-face" style={{transform:`translateY(${Math.sin(angle)*85-distance*40}px) rotateX(${-angle}rad) scale(${.72+.28*Math.cos(angle)})`,opacity:Math.max(0,1-Math.abs(distance)*.3)}}>{n}<span>{n===0?'keep coins':'coins'}</span></div>
              </div>;
            })}
          </div>
        </div>
      </div>
      <div className="coin-saving"><small>YOU SAVE</small><strong>{money(selected*coinValue)}</strong><p>{selected?`${balance-selected} coins left for next time`:'Keep your coins, or scroll to use them.'}</p><button type="button" className="text-btn" disabled={disabled||!limit} onClick={()=>choose(selected===limit?0:limit)}>{selected===limit?'Keep my coins':`Use maximum · ${limit}`}</button></div>
    </div>
    <p className="coin-picker-hint">Swipe up or down · Up to {limit} coins on this order</p>
  </section>;
}
