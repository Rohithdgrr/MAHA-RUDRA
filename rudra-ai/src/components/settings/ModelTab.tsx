import { strings } from "../../lib/i18n/en";
import { ModelPicker } from "../chat/ModelPicker";
import { Card, Section } from "./controls";

export function ModelTab() {
  return (
    <div>
      <Section title={strings.defaultAgentModel}>
        <Card>
          <ModelPicker />
        </Card>
      </Section>
    </div>
  );
}
