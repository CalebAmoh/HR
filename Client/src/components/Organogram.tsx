import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Network, AlignLeft, Layers, Users, Building, Briefcase, UserCircle, ChevronDown, ChevronRight, Workflow } from 'lucide-react';

export function Organogram({ data }: { data: any[] }) {
  const [viewFormat, setViewFormat] = useState<'vertical' | 'horizontal' | 'list'>('vertical');

  // Find root nodes (parent is 'None' or doesn't exist in data)
  const rootNodes = data.filter(d => d.parent === 'None' || !data.find(parent => parent.name === d.parent));

  return (
     <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="px-5 py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
           <div>
             <h3 className="syne font-bold text-slate-800 text-[15px]">Visual Hierarchy</h3>
             <p className="text-[12px] text-slate-500 font-medium">Interactive organization chart</p>
           </div>
           
           <div className="flex bg-slate-200 p-1 rounded-xl">
             <button 
               onClick={() => setViewFormat('vertical')}
               className={`p-1.5 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all ${viewFormat === 'vertical' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Network size={14} /> Tree
             </button>
             <button 
               onClick={() => setViewFormat('horizontal')}
               className={`p-1.5 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all ${viewFormat === 'horizontal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <Workflow size={14} /> Pipeline
             </button>
             <button 
               onClick={() => setViewFormat('list')}
               className={`p-1.5 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all ${viewFormat === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               <AlignLeft size={14} /> List
             </button>
           </div>
        </div>

        {/* Canvas */}
        <div className="p-6 sm:p-10 flex-1 overflow-auto bg-slate-50/30 flex justify-center items-start">
           <div className={`transition-all duration-500 ${viewFormat === 'horizontal' ? 'flex flex-col gap-6' : viewFormat === 'vertical' ? 'flex flex-col items-center' : 'w-full max-w-3xl'}`}>
             {rootNodes.length > 0 ? (
               rootNodes.map(node => (
                  <TreeNode key={node.id} node={node} allData={data} viewFormat={viewFormat} level={0} />
               ))
             ) : (
               <div className="text-sm text-slate-500 text-center mt-10">No company structures found.</div>
             )}
           </div>
        </div>
     </div>
  );
}

const getTypeIcon = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'company': return <Building size={16} className="text-indigo-500" />;
    case 'branch': return <Layers size={16} className="text-blue-500" />;
    case 'department': return <Briefcase size={16} className="text-amber-500" />;
    case 'team': return <Users size={16} className="text-emerald-500" />;
    default: return <UserCircle size={16} className="text-slate-500" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'company': return 'border-indigo-200 bg-indigo-50 text-indigo-700';
    case 'branch': return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'department': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'team': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    default: return 'border-slate-200 bg-slate-50 text-slate-700';
  }
};

function TreeNode({ node, allData, viewFormat, level }: any) {
  const [expanded, setExpanded] = useState(true);
  const children = allData.filter((d: any) => d.parent === node.name);
  const hasChildren = children.length > 0;

  if (viewFormat === 'list') {
    return (
      <div className="w-full">
         <div 
           className={`flex items-center gap-3 p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${level > 0 ? 'ml-6 border-l-2 border-l-slate-200 rounded-bl-lg' : ''}`}
           style={{ marginLeft: level > 0 ? `${level * 1.5}rem` : '0' }}
         >
           <button 
             onClick={() => setExpanded(!expanded)} 
             className={`w-5 h-5 flex items-center justify-center rounded border ${hasChildren ? 'border-slate-300 text-slate-500 bg-white hover:bg-slate-100' : 'opacity-0 cursor-default'}`}
           >
             {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
           </button>
           
           <div className="flex items-center gap-2">
             <div className={`p-1.5 rounded-lg border ${getTypeColor(node.type)} bg-white shadow-sm`}>
               {getTypeIcon(node.type)}
             </div>
             <div>
               <h4 className="text-sm font-bold text-slate-800 leading-tight mb-1">{node.name}</h4>
               <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
                 <span className={`px-1.5 py-0.5 rounded-sm border ${getTypeColor(node.type)} uppercase tracking-wider`}>{node.type}</span>
                 {node.manager && (
                   <>
                     <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                     <span>Manager: <span className="text-slate-700">{node.manager}</span></span>
                   </>
                 )}
               </div>
             </div>
           </div>
         </div>
         {expanded && hasChildren && (
           <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
             {children.map((child: any) => (
                <TreeNode key={child.id} node={child} allData={allData} viewFormat={viewFormat} level={level + 1} />
             ))}
           </motion.div>
         )}
      </div>
    );
  }

  if (viewFormat === 'horizontal') {
    return (
      <div className="flex items-stretch">
        <div className="relative flex items-center">
          <NodeCard node={node} toggle={() => setExpanded(!expanded)} expanded={expanded} hasChildren={hasChildren} viewFormat="horizontal" />
        </div>
        
        {expanded && hasChildren && (
          <div className="flex items-center">
            <div className="w-8 h-px bg-slate-300"></div>
            <div className="flex flex-col gap-4 py-4 relative">
              {children.map((child: any, index: number) => {
                const isFirst = index === 0;
                const isLast = index === children.length - 1;
                const isOnly = children.length === 1;

                return (
                  <div key={child.id} className="relative flex items-center pl-8">
                    {/* Vertical connector line */}
                    {!isOnly && (
                       <div className={`absolute left-0 w-px bg-slate-300
                          ${isFirst ? 'top-1/2 bottom-0' : isLast ? 'top-0 bottom-1/2' : 'top-0 bottom-0'}`}
                       ></div>
                    )}
                    {/* Horizontal branch to child */}
                    <div className="absolute left-0 top-1/2 w-8 h-px bg-slate-300 -translate-y-1/2"></div>
                    
                    <TreeNode node={child} allData={allData} viewFormat={viewFormat} level={level + 1} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vertical format (default tree)
  return (
    <div className="flex flex-col items-center">
      <NodeCard node={node} toggle={() => setExpanded(!expanded)} expanded={expanded} hasChildren={hasChildren} viewFormat="vertical" />
      
      {expanded && hasChildren && (
        <div className="flex flex-col items-center mt-6 relative">
          <div className="w-px h-6 bg-slate-300 absolute top-[-1.5rem]"></div>
          
          <div className="flex justify-center gap-6 relative">
            {children.map((child: any, index: number) => {
              const isFirst = index === 0;
              const isLast = index === children.length - 1;
              const isOnly = children.length === 1;

              return (
                <div key={child.id} className="relative flex flex-col items-center pt-6 px-3 lg:px-4">
                   {/* Horizontal connector line */}
                   {!isOnly && (
                      <div className={`absolute top-0 h-px bg-slate-300 
                         ${isFirst ? 'left-1/2 right-0' : isLast ? 'left-0 right-1/2' : 'left-0 right-0'}`} 
                      ></div>
                   )}
                   {/* Vertical drop line to child */}
                   <div className="absolute top-0 w-px h-6 bg-slate-300 left-1/2 -translate-x-1/2"></div>
                   
                   <TreeNode node={child} allData={allData} viewFormat={viewFormat} level={level + 1} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function NodeCard({ node, toggle, expanded, hasChildren, viewFormat }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }} 
      animate={{ opacity: 1, scale: 1 }}
      className="relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-[200px] z-10"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${getTypeColor(node.type)}`}>
           {getTypeIcon(node.type)}
        </div>
        <div>
          <h4 className="text-[13px] font-bold text-slate-800 leading-tight">{node.name}</h4>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-[1px] mt-1 inline-block rounded border ${getTypeColor(node.type)}`}>
            {node.type}
          </span>
        </div>
      </div>
      
      <div className="text-[11px] text-slate-500 font-medium bg-slate-50 p-2 rounded-md border border-slate-100 flex items-center gap-1.5">
        <UserCircle size={13} className="text-slate-400" />
        {node.manager || 'No Manager'}
      </div>

      {hasChildren && (
        <button 
          onClick={toggle}
          className={`absolute ${viewFormat === 'vertical' ? 'bottom-[-10px] left-1/2 -translate-x-1/2' : 'right-[-10px] top-1/2 -translate-y-1/2'} 
                     w-5 h-5 bg-white border border-slate-300 rounded-full flex items-center justify-center text-slate-500 shadow-sm hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-300 transition-colors z-20`}
        >
          {viewFormat === 'vertical' 
            ? (expanded ? <ChevronDown size={14} className="transform rotate-180" /> : <ChevronDown size={14} />)
            : (expanded ? <ChevronRight size={14} className="transform rotate-180" /> : <ChevronRight size={14} />)
          }
        </button>
      )}
    </motion.div>
  );
}
