import styles from '../../../../styles/components/Settings/Panels/SettingsKeyboard/SettingsKeyboard.module.scss';

type KeyboardInstructionProps = {
  keys: string;
  label: string;
  description: string;
};

export function KeyboardInstruction({ keys, label, description }: KeyboardInstructionProps) {
  return (
    <section className={styles.item}>
      <p className={styles.keys}>{keys}</p>
      <h3 className={styles.label}>{label}</h3>
      <p>{description}</p>
    </section>
  );
}
