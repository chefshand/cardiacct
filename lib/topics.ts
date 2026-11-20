// Study topics, loosely following the domains of the CBCCT (cardiovascular CT) board exam.
export const TOPICS = [
  { key: "physics", label: "Physics, acquisition & radiation", search: "radiation dose kVp temporal resolution artifact acquisition reconstruction" },
  { key: "protocol", label: "Patient prep, contrast & protocols", search: "beta blocker nitroglycerin contrast bolus tracking protocol heart rate" },
  { key: "anatomy", label: "Coronary anatomy & anomalies", search: "coronary anatomy anomaly segment dominance bridge origin course" },
  { key: "cac", label: "Coronary calcium scoring", search: "calcium score Agatston CAC MESA percentile" },
  { key: "cad", label: "Coronary stenosis & plaque", search: "stenosis plaque high-risk remodeling low attenuation FFR" },
  { key: "reporting", label: "CAD-RADS, reporting & guidelines", search: "CAD-RADS report appropriate use guideline recommendation" },
  { key: "stents_grafts", label: "Stents, grafts & CTO", search: "stent graft bypass LIMA SVG occlusion CTO" },
  { key: "function", label: "Ventricles, function & cardiomyopathy", search: "ventricle ejection fraction cardiomyopathy hypertrophic myocardium" },
  { key: "valves", label: "Valves", search: "aortic valve mitral valve bicuspid stenosis regurgitation prosthetic" },
  { key: "structural", label: "Structural interventions (TAVR, LAAO, mitral, tricuspid)", search: "TAVR annulus LAAO appendage mitral tricuspid transcatheter access" },
  { key: "congenital", label: "Congenital heart disease", search: "congenital septal defect anomalous pulmonary venous tetralogy" },
  { key: "aorta", label: "Aorta, great vessels & pulmonary veins", search: "aorta aneurysm dissection pulmonary vein ablation" },
  { key: "pericardium_masses", label: "Pericardium, masses & thrombus", search: "pericardium constriction mass tumor thrombus myxoma" },
  { key: "extracardiac", label: "Extracardiac findings", search: "extracardiac lung nodule incidental finding" },
] as const;

export type TopicKey = (typeof TOPICS)[number]["key"] | "general";

export function topicLabel(key: string) {
  return TOPICS.find((t) => t.key === key)?.label ?? "General";
}

export const TOPIC_KEYS = TOPICS.map((t) => t.key) as string[];
