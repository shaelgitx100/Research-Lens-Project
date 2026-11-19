import { useMemo, useState } from 'react';
import { Compass, Search } from 'lucide-react';
import './literature-map.css';

type MapPaper = {
  _id?: string;
  projectId?: string;
  title: string;
  authors?: string[];
  keywords?: string[];
  abstract?: string;
  extractedText?: string;
  publicationYear?: number;
  venue?: string;
  publicationUrl?: string;
  doi?: string;
};

type MapProject = {
  _id: string;
  title: string;
  topic?: string;
  keywords?: string[];
};

type NodeType = 'paper' | 'author' | 'keyword' | 'topic';
type MapNode = { id: string; label: string; type: NodeType; description: string; paper?: MapPaper; x: number; y: number };
type MapEdge = { id: string; source: string; target: string; label: string };

const NODE_LABELS: Record<NodeType, string> = { paper: 'Papers', author: 'Authors', keyword: 'Keywords', topic: 'Project topics' };
const norm = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const CONTENT_STOP_WORDS = new Set('research study studies method methods model models data analysis result results approach using used based paper papers'.split(/\s+/));
const TEXT_STOP_WORDS = new Set('about after again against all also although among an and any are around as at based be because been before being between both but by can could did do does during each either enough especially etc even ever every few for from further had has have having he her here hers herself him himself his how however i if in into is it its itself just less many may me might more most much must my myself neither no nor not of off on once one only or other our ours ourselves out over own same she should since so some such than that the their theirs them themselves then there these they this those through to too under until up upon us very was we were what when where which while who whom whose why will with within without would you your yours yourselves according academic analysis approach accordingly actually added additional affect affected affects afterwards almost alone along already although always among amongst anyone anything anyway anywhere apparently appear appreciate appropriate appropriate associated available away became become becomes becoming beforehand behalf behind besides beyond brief came certain clearly come contain concerning consequently consider considered course currently definitely described despite detailed due edu eight else elsewhere employed entirely especially et ever exactly example existing far fifth first following former formerly forth found four hence her hereby herein hereupon herself high hopefully ignored immediate inasmuch indicate indicated indicates inner insofar instead just latter latterly least less lest let like likely little look looking ltd mainly may maybe meantime meanwhile merely moreover mostly mostly name namely nd near nearly necessary need needs neither never nevertheless next nine nobody non none nonetheless noone normally nothing novel now nowhere obviously often oh okay old once onwards others otherwise outside overall particular particularly per perhaps placed please plus possible presumably probably provides que quite rather rd re really reasonably regarding regardless regards relatively respectively right said saw say saying says second secondly see seeing seem seemed seeming seems seen self selves sensible sent serious seriously seven several shall six somehow someone something sometime sometimes somewhat somewhere soon sorry specified specify specify sub such sup sure take taken tell tends th thank thanks thanx third thorough thoroughly though three throughout thru thus together took toward towards tried tries truly try trying twice two un uncom used use used using various via viz vs want wants way welcome well went whatever whenever whereafter whereas whereby wherein whereupon wherever whether whence whenever whereafter whenever whither whoever whole willing wish within wonder yes yet'.split(/\s+/));

function makeMap(project: Partial<MapProject>, papers: MapPaper[]) {
  const nodes = new Map<string, Omit<MapNode, 'x' | 'y'>>();
  const edges = new Map<string, MapEdge>();
  const center = { x: 480, y: 280 };

  const addNode = (node: Omit<MapNode, 'x' | 'y'>) => { if (!nodes.has(node.id)) nodes.set(node.id, node); };
  const addEdge = (source: string, target: string, label: string) => {
    const key = [source, target].sort().join('|');
    if (!edges.has(key)) edges.set(key, { id: key, source, target, label });
  };
  const topics = [...new Set([project.topic || '', ...(project.keywords || [])].map((item) => item.trim()).filter((item) => item.length > 2))];
  const termCounts = papers.map((paper) => {
    const text = `${paper.title} ${paper.abstract || ''} ${(paper.extractedText || '').slice(0, 12000)}`.toLowerCase();
    const counts = new Map<string, number>();
    (text.match(/[a-z][a-z0-9-]{2,}/g) || []).forEach((term) => {
      if (!TEXT_STOP_WORDS.has(term) && !CONTENT_STOP_WORDS.has(term) && !/^\d+$/.test(term)) counts.set(term, (counts.get(term) || 0) + 1);
    });
    return counts;
  });
  const documentFrequency = new Map<string, number>();
  termCounts.forEach((counts) => counts.forEach((_count, term) => documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1)));
  const sharedTerms = new Set([...documentFrequency].filter(([, count]) => count > 1).map(([term]) => term));

  papers.forEach((paper, index) => {
    const id = `paper:${paper._id || index}`;
    addNode({ id, label: paper.title, type: 'paper', description: 'Saved publication metadata in this project.', paper });

    [...new Set((paper.authors || []).map((name) => name.trim()).filter(Boolean))].slice(0, 6).forEach((name) => {
      const authorId = `author:${norm(name)}`;
      addNode({ id: authorId, label: name, type: 'author', description: 'Author listed in the saved publication metadata.' });
      addEdge(id, authorId, 'authored by');
    });

    const explicitKeywords = [...new Set((paper.keywords || []).map((word) => word.trim()).filter(Boolean))].slice(0, 8);
    explicitKeywords.forEach((word) => {
      const keywordId = `keyword:${norm(word)}`;
      addNode({ id: keywordId, label: word, type: 'keyword', description: 'Keyword listed in the saved publication metadata.' });
      addEdge(id, keywordId, 'tagged with');
    });
    const explicitIds = new Set(explicitKeywords.map((word) => norm(word)));
    [...(termCounts[index] || [])]
      .filter(([term]) => sharedTerms.has(term) && !explicitIds.has(term))
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .forEach(([term]) => {
        const keywordId = `keyword:${term}`;
        const label = term.length <= 3 ? term.toUpperCase() : `${term[0].toUpperCase()}${term.slice(1)}`;
        addNode({ id: keywordId, label, type: 'keyword', description: 'Term found in the title, abstract, or extracted text of multiple saved papers.' });
        addEdge(id, keywordId, 'shares term');
      });

    const haystack = norm([paper.title, paper.abstract || '', ...(paper.keywords || [])].join(' '));
    topics.forEach((topic) => {
      if (!haystack.includes(norm(topic))) return;
      const topicId = `topic:${norm(topic)}`;
      addNode({ id: topicId, label: topic, type: 'topic', description: 'Project topic or keyword found in this paper’s saved metadata.' });
      addEdge(id, topicId, 'matches project topic');
    });
  });

  const paperNodes = [...nodes.values()].filter((node) => node.type === 'paper');
  const conceptNodes = [...nodes.values()].filter((node) => node.type !== 'paper').sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
  const positionedNodes = [
    ...paperNodes.map((node, index) => {
      const angle = (index / Math.max(1, paperNodes.length)) * Math.PI * 2 - Math.PI / 2;
      return { ...node, x: center.x + Math.cos(angle) * 205, y: center.y + Math.sin(angle) * 155 };
    }),
    ...conceptNodes.map((node, index) => {
      const angle = (index / Math.max(1, conceptNodes.length)) * Math.PI * 2 - Math.PI / 2;
      return { ...node, x: center.x + Math.cos(angle) * 325, y: center.y + Math.sin(angle) * 215 };
    }),
  ];
  return { nodes: positionedNodes, edges: [...edges.values()] };
}

export default function LiteratureMap({ project, papers, onCreateProject, onDiscover }: {
  project?: MapProject;
  papers: MapPaper[];
  onCreateProject: () => void;
  onDiscover: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<NodeType>>(new Set(['paper', 'author', 'keyword', 'topic']));
  const projectPapers = useMemo(() => project ? papers.filter((paper) => String(paper.projectId) === String(project._id)) : papers, [project, papers]);
  const graph = useMemo(() => projectPapers.length ? makeMap(project || {}, projectPapers) : { nodes: [], edges: [] }, [project, projectPapers]);
  const visibleNodes = useMemo(() => graph.nodes.filter((node) => visibleTypes.has(node.type)), [graph.nodes, visibleTypes]);
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(() => graph.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)), [graph.edges, visibleIds]);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const queryText = norm(query);
  const matchingIds = useMemo(() => new Set(visibleNodes.filter((node) => queryText && norm(node.label).includes(queryText)).map((node) => node.id)), [visibleNodes, queryText]);
  const connectedEdges = useMemo(() => selectedId ? graph.edges.filter((edge) => edge.source === selectedId || edge.target === selectedId) : [], [graph.edges, selectedId]);
  const connectedIds = useMemo(() => new Set(connectedEdges.flatMap((edge) => [edge.source, edge.target])), [connectedEdges]);
  const degreeById = useMemo(() => {
    const degree = new Map<string, number>();
    graph.edges.forEach((edge) => {
      degree.set(edge.source, (degree.get(edge.source) || 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) || 0) + 1);
    });
    return degree;
  }, [graph.edges]);
  const conceptCount = graph.nodes.filter((node) => node.type !== 'paper').length;
  const toggleType = (type: NodeType) => setVisibleTypes((current) => {
    const next = new Set(current);
    if (next.has(type)) next.delete(type); else next.add(type);
    return next;
  });

  if (projectPapers.length === 0) return (
    <section className="panel literature-map-empty">
      <div className="literature-map-empty-icon"><Compass size={22}/></div>
      <div><h2>{project ? `No papers in ${project.title} yet` : 'No saved papers to map yet'}</h2><p>Find and save literature{project ? ' to this project' : ' to your library'}. The map will connect metadata from your collection.</p></div>
      <button className="button primary" onClick={onDiscover}>Find papers</button>
      {!project && <button className="button secondary" onClick={onCreateProject}>Create project</button>}
    </section>
  );

  return (
    <section className="literature-map panel" aria-label="Project literature map">
      <div className="literature-map-heading">
        <div>
          <div className="section-kicker">{project ? 'PROJECT LITERATURE MAP' : 'WORKSPACE LITERATURE MAP'}</div>
          <h2>{project?.title || 'My saved literature'}</h2>
          <p>Explore links grounded in saved authors, keywords, project topics, and repeated terms in paper text.</p>
        </div>
        <div className="literature-map-stats">
          <span><strong>{projectPapers.length}</strong> papers</span>
          <span><strong>{conceptCount}</strong> concepts</span>
          <span><strong>{graph.edges.length}</strong> links</span>
        </div>
      </div>
      {conceptCount === 0 && (
        <div className="literature-map-no-links" role="status">
          No author, keyword, or shared text terms are available to connect these papers yet. The paper nodes are still shown below.
        </div>
      )}
          <div className="literature-map-controls">
            <label className="literature-map-search"><Search size={16}/><input aria-label="Search map nodes" placeholder="Find a paper, author, or keyword" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
            <div className="literature-map-filters" aria-label="Map node filters">
              {(Object.keys(NODE_LABELS) as NodeType[]).map((type) => (
                <button key={type} className={`literature-map-filter ${visibleTypes.has(type) ? 'active' : ''}`} onClick={() => toggleType(type)} aria-pressed={visibleTypes.has(type)}>
                  <i className={`map-dot map-dot-${type}`}/>{NODE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          <div className="literature-map-content">
            <div className="literature-map-canvas">
              <svg viewBox="0 0 960 560" role="img" aria-label={`Literature map for ${project?.title || 'your saved literature'}. Select a node to inspect its connections.`}>
                {visibleEdges.map((edge) => {
                  const source = nodeById.get(edge.source), target = nodeById.get(edge.target);
                  if (!source || !target) return null;
                  const active = selectedId === source.id || selectedId === target.id;
                  const dimmed = queryText.length > 0 && !matchingIds.has(source.id) && !matchingIds.has(target.id);
                  return <line key={edge.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} className={`map-edge ${active ? 'selected' : ''}`} opacity={dimmed ? 0.1 : active || !selectedNode ? 0.6 : 0.12}/>;
                })}
                {visibleNodes.map((node) => {
                  const degree = degreeById.get(node.id) || 0;
                  const selected = selectedId === node.id;
                  const dimmed = queryText.length > 0 && !matchingIds.has(node.id);
                  const showLabel = node.type === 'paper' || selected || degree > 1 || queryText.length > 0;
                  const labelLimit = node.type === 'paper' ? 26 : 18;
                  const shortLabel = node.label.length > labelLimit ? `${node.label.slice(0, labelLimit - 2)}…` : node.label;
                  return (
                    <g key={node.id} className={`map-node map-node-${node.type} ${selected ? 'selected' : ''}`} transform={`translate(${node.x} ${node.y})`} opacity={dimmed ? 0.2 : selectedNode && !selected && !connectedIds.has(node.id) ? 0.35 : 1} role="button" tabIndex={0} aria-label={`${NODE_LABELS[node.type].replace(/s$/, '')}: ${node.label}`} aria-pressed={selected} onClick={() => setSelectedId(selected ? null : node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(selected ? null : node.id); } }}>
                      <circle r={node.type === 'paper' ? 8 : 5 + Math.min(degree, 5)}/>
                      {showLabel && <text y={node.type === 'paper' ? 22 : 17} textAnchor="middle">{shortLabel}</text>}
                    </g>
                  );
                })}
              </svg>
              {visibleNodes.length === 0 && <div className="literature-map-no-visible-nodes">Turn on a node type to show the map.</div>}
              <div className="literature-map-help">Select nodes to inspect connections · Scroll to explore on smaller screens</div>
            </div>
            <aside className="literature-map-details">
              {!selectedNode ? (
                <div className="literature-map-detail-empty"><Search size={18}/><strong>Select a node</strong><span>Inspect a paper, author, or concept and its connected records.</span></div>
              ) : (
                <>
                  <span className={`literature-map-type map-type-${selectedNode.type}`}>{NODE_LABELS[selectedNode.type].replace(/s$/, '')}</span>
                  <h3>{selectedNode.label}</h3>
                  {selectedNode.paper ? (
                    <>
                      <p className="literature-map-meta">{selectedNode.paper.authors?.join(', ') || 'Authors unavailable'}{selectedNode.paper.publicationYear ? ` · ${selectedNode.paper.publicationYear}` : ''}{selectedNode.paper.venue ? ` · ${selectedNode.paper.venue}` : ''}</p>
                      {selectedNode.paper.abstract && <p className="literature-map-abstract">{selectedNode.paper.abstract}</p>}
                      {(selectedNode.paper.publicationUrl || selectedNode.paper.doi) && <a className="literature-map-source" href={selectedNode.paper.publicationUrl || `https://doi.org/${selectedNode.paper.doi}`} target="_blank" rel="noreferrer">Open publication ↗</a>}
                    </>
                  ) : <p className="literature-map-meta">{selectedNode.description}</p>}
                  <div className="literature-map-connections">
                    <strong>Connections <span>{connectedEdges.length}</span></strong>
                    {connectedEdges.length ? connectedEdges.map((edge) => {
                      const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const other = nodeById.get(otherId);
                      return other ? <button key={edge.id} onClick={() => setSelectedId(other.id)}><span className={`map-dot map-dot-${other.type}`}/><span>{other.label}</span><small>{edge.label}</small></button> : null;
                    }) : <p>No connected records in this project.</p>}
                  </div>
                </>
              )}
            </aside>
          </div>
          <p className="literature-map-note">{visibleNodes.length} nodes and {visibleEdges.length} links shown. Links reflect saved metadata or terms repeated in titles, abstracts, or extracted text; semantic relationships are not invented.</p>
    </section>
  );
}
