import useBaseUrl from '@docusaurus/useBaseUrl';

export default function Fhir262Report() {
  return (
    <iframe
      title="FHIR262 conformance report"
      src={useBaseUrl('docs/conformance/fhir262/app/')}
      style={{border: 0, height: '80vh', width: '100%'}}
    />
  );
}
