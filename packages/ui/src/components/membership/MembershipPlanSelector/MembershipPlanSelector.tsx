'use client';

import classNames from 'classnames';

import styles from './MembershipPlanSelector.module.scss';

export type MembershipPlanOption = {
  value: string;
  label: string;
  price: string;
  period: string;
  savingsLabel?: string;
};

export type MembershipPlanSelectorProps = {
  name: string;
  legend: string;
  options: MembershipPlanOption[];
  selectedValue: string;
  onChange: (value: string) => void;
};

export function MembershipPlanSelector({
  name,
  legend,
  options,
  selectedValue,
  onChange,
}: MembershipPlanSelectorProps) {
  return (
    <fieldset className={styles.root}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options} role="radiogroup" aria-label={legend}>
        {options.map((option) => {
          const selected = option.value === selectedValue;
          const hasPrice = option.price !== '';
          const priceLabel = hasPrice
            ? `${option.label}, ${option.price}${option.period}`
            : option.label;
          const accessibleName =
            option.savingsLabel !== undefined && option.savingsLabel !== ''
              ? `${priceLabel}, ${option.savingsLabel}`
              : priceLabel;
          return (
            <label
              key={option.value}
              className={classNames(styles.option, selected ? styles.optionSelected : null)}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                aria-label={accessibleName}
                onChange={() => {
                  onChange(option.value);
                }}
                className={styles.radio}
              />
              <span className={styles.label} aria-hidden="true">
                {option.label}
              </span>
              {hasPrice ? (
                <span className={styles.priceRow} aria-hidden="true">
                  <span className={styles.price}>{option.price}</span>
                  {option.savingsLabel !== undefined && option.savingsLabel !== '' ? (
                    <span className={styles.savings}>{option.savingsLabel}</span>
                  ) : null}
                </span>
              ) : null}
              {hasPrice && option.period !== '' ? (
                <span className={styles.period} aria-hidden="true">
                  {option.period}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
