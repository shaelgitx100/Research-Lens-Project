/**
 * Extensible vocabularies used by the rule based analysis, gap, comparison and mapping modules.
 * Add families or themes here to adapt ResearchLens to a new research domain.
 */
export interface Family { id: string; label: string; re: RegExp }
export interface FamilyGroup { id: string; label: string; kind: 'method' | 'model'; families: Family[] }

export const GROUPS: FamilyGroup[] = [
  {
    id: 'evaluationStrategy', label: 'Evaluation strategy', kind: 'method',
    families: [
      { id: 'perturbation', label: 'Perturbation based evaluation', re: /perturb|region perturbation|feature (removal|masking|ablation)|deletion (curve|metric)|random (feature )?masking/i },
      { id: 'retraining', label: 'Retraining based evaluation', re: /retrain|remove and retrain|\broar\b/i },
      { id: 'syntheticGroundTruth', label: 'Synthetic ground truth evaluation', re: /ground[\s]truth|synthetic (data|benchmark)/i },
      { id: 'humanGrounded', label: 'Human grounded evaluation', re: /user study|human (evaluation|subjects|annotat)|crowdsourc|participants/i },
      { id: 'sanityChecks', label: 'Sanity check evaluation', re: /sanity check|parameter randomi[sz]ation|axiom/i },
    ],
  },
  {
    id: 'explanationMethod', label: 'Explanation method', kind: 'method',
    families: [
      { id: 'shap', label: 'SHAP', re: /\bshap\b|shapley/i },
      { id: 'lime', label: 'LIME', re: /\blime\b/i },
      { id: 'gradient', label: 'Gradient based attribution', re: /gradient based|saliency|integrated gradients|gradcam|attribution/i },
      { id: 'counterfactual', label: 'Counterfactual explanations', re: /counterfactual/i },
    ],
  },
  {
    id: 'modelClass', label: 'Model class', kind: 'model',
    families: [
      { id: 'linearModels', label: 'Linear models', re: /linear (model|regression)|logistic regression|linear classifier/i },
      { id: 'treeModels', label: 'Tree based models', re: /decision tree|random forest|gradient boost|tree ensemble|tree based/i },
      { id: 'neuralNetworks', label: 'Neural networks', re: /neural network|deep (learning|network)|\bcnn\b|convolutional|multilayer/i },
      { id: 'transformers', label: 'Transformers', re: /transformer|\bbert\b|pretrained language/i },
    ],
  },
  {
    id: 'studyDesign', label: 'Study design', kind: 'method',
    families: [
      { id: 'empiricalBenchmark', label: 'Empirical benchmark', re: /benchmark|empirical (study|evaluation)|experiment/i },
      { id: 'theoretical', label: 'Theoretical analysis', re: /theoretical|axiom|proof/i },
      { id: 'caseStudy', label: 'Case study', re: /case study/i },
      { id: 'survey', label: 'Survey or review', re: /survey|systematic review|questionnaire|interview/i },
      { id: 'simulation', label: 'Simulation', re: /simulat/i },
    ],
  },
  {
    id: 'federatedStrategy', label: 'Federated learning strategy', kind: 'method',
    families: [
      { id: 'fedAvg', label: 'Federated averaging', re: /federated averaging|fedavg/i },
      { id: 'proximal', label: 'Proximal regularization', re: /proximal|fedprox/i },
      { id: 'personalization', label: 'Personalization', re: /personali[sz]/i },
      { id: 'differentialPrivacy', label: 'Differential privacy', re: /differential privacy|secure aggregation/i },
    ],
  },
  {
    id: 'lowResourceStrategy', label: 'Low resource strategy', kind: 'method',
    families: [
      { id: 'transferLearning', label: 'Transfer learning', re: /transfer learning|multilingual (transfer|pretrained)|zero shot|cross lingual/i },
      { id: 'dataAugmentation', label: 'Data augmentation', re: /augmentation|back translation/i },
      { id: 'communityData', label: 'Community data creation', re: /community driven|annotation (effort|practice)|corpus (building|creation)/i },
    ],
  },
];

export interface Theme { id: string; label: string; kind: 'limitation' | 'dataset' | 'model'; re: RegExp }

export const LIMITATION_THEMES: Theme[] = [
  { id: 'smallSample', label: 'Small or limited sample size', kind: 'dataset', re: /small (sample|dataset|data set|number|evaluation)|limited (sample|data|number of)|few (samples|datasets|participants|sites)|sample sizes?/i },
  { id: 'narrowDatasets', label: 'Evaluation on a single or narrow set of datasets', kind: 'dataset', re: /single (dataset|image dataset|imaging dataset|case study)|only (one|two) (tabular |image )?datasets?|one (image )?dataset|limited to (a |one )(single )?(image )?dataset|only (a )?single dataset/i },
  { id: 'syntheticOnly', label: 'Synthetic or simulated data only', kind: 'dataset', re: /synthetic (data|only|setting)|simulated (data|only|sites|environment)|simulation rather than/i },
  { id: 'noRealWorld', label: 'Lack of real world validation', kind: 'limitation', re: /real[\s]world|real hospital|deployment|in the wild|theoretical and lacks/i },
  { id: 'imbalance', label: 'Class or data imbalance', kind: 'dataset', re: /imbalance/i },
  { id: 'coverage', label: 'Limited geographic, dialect or demographic coverage', kind: 'dataset', re: /geograph|demographic|dialect|single (country|institution|hospital)|cover(s)? (news|only)|standard varieties/i },
  { id: 'oodSensitivity', label: 'Sensitivity to out of distribution inputs', kind: 'model', re: /out[\s-]of[\s-]distribution|\bood\b|distribution shift|outside (the )?(training|data) distribution/i },
  { id: 'simpleModelsOnly', label: 'Evaluation restricted to linear or simple models', kind: 'model', re: /linear models? only|restricted to (linear|simple)|only (linear|simple) models|limited to (linear|simple)|may not generali[sz]e to non linear|only gradient based|tabular data only|only tabular/i },
  { id: 'metricReliability', label: 'Reliability of evaluation metrics', kind: 'limitation', re: /metric (reliability|robustness|sensitiv)|reliab\w* of (the )?(fidelity )?(metric|evaluation)|not isolated from|variance across seeds/i },
  { id: 'computeCost', label: 'High computational cost or scalability', kind: 'limitation', re: /computational(ly)? (cost|expens|overhead)|does not scale|scalab/i },
  { id: 'baselines', label: 'Limited baseline comparisons', kind: 'limitation', re: /baseline|few comparisons|not compared/i },
  { id: 'privacyAttacks', label: 'Privacy attacks not evaluated', kind: 'limitation', re: /privacy attacks?|adversary|membership inference/i },
];

export const METRICS: { re: RegExp; label: string }[] = [
  { re: /infidelity/i, label: 'Infidelity' }, { re: /faithfulness correlation/i, label: 'Faithfulness correlation' },
  { re: /fidelity/i, label: 'Fidelity' }, { re: /\baccuracy\b/i, label: 'Accuracy' }, { re: /\bf1\b/i, label: 'F1 score' },
  { re: /\bauc\b|auroc/i, label: 'AUC' }, { re: /\bbleu\b/i, label: 'BLEU' }, { re: /correlation/i, label: 'Rank correlation' },
  { re: /precision|recall/i, label: 'Precision and recall' }, { re: /robustness/i, label: 'Robustness' },
  { re: /convergence/i, label: 'Convergence rate' }, { re: /attack success/i, label: 'Attack success rate' },
  { re: /variance/i, label: 'Variance across seeds' },
];

export const REAL_WORLD_CUES = /deploy|clinical|real[\s]world|industry|healthcare|hospital|safety|regulat|practition|user|community/i;

export function matchFamilies(text: string, groups: FamilyGroup[] = GROUPS): { group: FamilyGroup; family: Family }[] {
  const out: { group: FamilyGroup; family: Family }[] = [];
  for (const group of groups) for (const family of group.families) if (family.re.test(text)) out.push({ group, family });
  return out;
}

const KNOWN_DATASETS = /\b(ImageNet|CIFAR\s?10{0,2}|MNIST|Fashion MNIST|UCI Adult|COMPAS|MIMIC(?: III| IV)?|CheXpert|SQuAD|GLUE|COCO|OpenImages|IMDB|SST2?)\b/g;
const NAMED_DATASET = /\b([A-Z][A-Za-z0-9]*(?:\s[A-Z][A-Za-z0-9]*){0,2})\s(?:dataset|data set|corpus|benchmark)s?\b/g;

export function extractDatasetNames(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(KNOWN_DATASETS)) names.add(m[1].replace(/\s+/g, ' '));
  for (const m of text.matchAll(NAMED_DATASET)) {
    const n = m[1].trim();
    if (!/^(The|This|These|A|An|Our|We|Single|One|Two|Only|Image|Tabular)$/.test(n) && n.length > 2) names.add(n);
  }
  return [...names].slice(0, 6);
}
