'use client';

import classNames from 'classnames';

import { PopoverIcon } from '../../feedback/PopoverIcon/PopoverIcon';
import { LoadingSpinner } from '../../layout/LoadingSpinner/LoadingSpinner';

import styles from './SwitchButton.module.scss';

type SwitchButtonBaseProps = {
  id?: string;
  label: string;
  /**
   * The label stays the switch's accessible name and is not shown. Use this when a heading
   * already names the same control.
   */
  hideLabel?: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
  loading?: boolean;
  className?: string;
  'aria-describedby'?: string;
  /** Localized visible labels for the on/off state text beside the switch. */
  stateOnLabel: string;
  stateOffLabel: string;
};

export type SwitchButtonProps =
  | (SwitchButtonBaseProps & { helpText?: undefined; helpAriaLabel?: undefined })
  | (SwitchButtonBaseProps & { helpText: string; helpAriaLabel: string });

export function SwitchButton(props: SwitchButtonProps) {
  const {
    id,
    label,
    hideLabel,
    checked,
    onChange,
    loading,
    className,
    'aria-describedby': ariaDescribedBy,
    stateOnLabel,
    stateOffLabel,
  } = props;

  const helpText = 'helpText' in props && props.helpText !== undefined ? props.helpText : undefined;
  const helpAriaLabel =
    'helpAriaLabel' in props && props.helpAriaLabel !== undefined ? props.helpAriaLabel : undefined;
  const help =
    helpText !== undefined && helpAriaLabel !== undefined
      ? { ariaLabel: helpAriaLabel, body: helpText }
      : null;
  const labelIsHidden = hideLabel === true;

  const handleToggle = () => {
    if (loading === true) {
      return;
    }
    onChange(!checked);
  };

  return (
    <div className={classNames(styles.wrapper, className)}>
      {labelIsHidden ? null : (
        <div className={styles.headerRow}>
          <div className={styles.labelWrapper}>
            <label htmlFor={id} className={styles.label}>
              {label}
            </label>
            {help !== null ? <PopoverIcon ariaLabel={help.ariaLabel} body={help.body} /> : null}
          </div>
        </div>
      )}

      <div className={styles.controlRow}>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-describedby={ariaDescribedBy}
          aria-label={labelIsHidden ? label : undefined}
          className={classNames(
            styles.switch,
            checked ? styles.on : styles.off,
            loading === true ? styles.disabled : ''
          )}
          onClick={handleToggle}
          disabled={loading === true}
          aria-disabled={loading === true}
        >
          <span className={styles.track} />
          <span className={styles.thumb} />
        </button>

        <div className={styles.stateLabel} aria-hidden>
          {checked ? stateOnLabel : stateOffLabel}
        </div>

        {labelIsHidden && help !== null ? (
          <PopoverIcon ariaLabel={help.ariaLabel} body={help.body} />
        ) : null}

        {loading === true ? (
          <div className={styles.loadingWrapper} aria-hidden>
            <LoadingSpinner decorative size="small" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
