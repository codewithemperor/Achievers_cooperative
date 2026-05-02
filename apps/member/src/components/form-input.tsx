"use client";

import React from "react";
import { Controller, Control, FieldValues, Path } from "react-hook-form";
import type { DateValue, TimeValue } from "@heroui/react";
import {
  TextField,
  Label,
  FieldError,
  InputGroup,
  NumberField,
  Description,
  Calendar,
  DateField,
  DatePicker,
  DateRangePicker,
  RangeCalendar,
  TimeField,
  Select,
  ListBox,
  Autocomplete,
  SearchField,
  EmptyState,
  useFilter,
} from "@heroui/react";
import type { Key } from "@heroui/react";
import {
  parseDate,
  parseAbsoluteToLocal,
  CalendarDate,
} from "@internationalized/date";

// ==================== BASE TYPES ====================

interface BaseInputProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
  description?: string;
}

export type { BaseInputProps };

// ==================== TEXT INPUT ====================

interface TextInputProps<T extends FieldValues> extends BaseInputProps<T> {
  type?: "text" | "email" | "tel" | "url" | "password";
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

export type { TextInputProps };

export function TextInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  type = "text",
  startContent,
  endContent,
  isRequired = false,
  isDisabled = false,
  className,
  description,
}: TextInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => {
        const { value, onChange, ...restField } = field;

        const formattedValue =
          typeof value === "string"
            ? value
            : value !== undefined && value !== null
              ? String(value)
              : "";

        return (
          <TextField
            className={className}
            isDisabled={isDisabled}
            isRequired={isRequired}
            isInvalid={!!error}
          >
            <Label>{label}</Label>
            <InputGroup>
              {startContent && (
                <InputGroup.Prefix>{startContent}</InputGroup.Prefix>
              )}
              <InputGroup.Input
                {...restField}
                type={type}
                placeholder={placeholder}
                value={formattedValue}
                onChange={(e) => onChange(e.target.value)}
              />
              {endContent && (
                <InputGroup.Suffix>{endContent}</InputGroup.Suffix>
              )}
            </InputGroup>
            {description && !error && <Description>{description}</Description>}
            <FieldError>{error?.message}</FieldError>
          </TextField>
        );
      }}
    />
  );
}

// ==================== PASSWORD INPUT ====================

interface PasswordInputProps<T extends FieldValues> extends BaseInputProps<T> {
  startContent?: React.ReactNode;
}

export type { PasswordInputProps };

export function PasswordInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  startContent,
  isRequired = false,
  isDisabled = false,
  className,
  description,
}: PasswordInputProps<T>) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <TextField
          className={className}
          isDisabled={isDisabled}
          isRequired={isRequired}
          isInvalid={!!error}
        >
          <Label>{label}</Label>
          <InputGroup>
            {startContent && (
              <InputGroup.Prefix>{startContent}</InputGroup.Prefix>
            )}
            <InputGroup.Input
              {...field}
              type={showPassword ? "text" : "password"}
              placeholder={placeholder}
              value={field.value ?? ""}
            />
            <InputGroup.Suffix>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex items-center bg-primary justify-center text-default-400 hover:text-foreground focus:outline-none"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  // Eye-slash icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                    />
                  </svg>
                ) : (
                  // Eye icon
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="size-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                )}
              </button>
            </InputGroup.Suffix>
          </InputGroup>
          {description && !error && <Description>{description}</Description>}
          <FieldError>{error?.message}</FieldError>
        </TextField>
      )}
    />
  );
}

// ==================== NUMBER INPUT ====================

interface NumberInputProps<T extends FieldValues> extends BaseInputProps<T> {
  min?: number;
  max?: number;
  step?: number;
  formatOptions?: Intl.NumberFormatOptions;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

export type { NumberInputProps };

export function NumberInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  min,
  max,
  step = 1,
  formatOptions,
  isRequired = false,
  isDisabled = false,
  className,
  description,
}: NumberInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <NumberField
          className={className}
          isDisabled={isDisabled}
          isRequired={isRequired}
          isInvalid={!!error}
          minValue={min}
          maxValue={max}
          step={step}
          formatOptions={formatOptions}
          value={
            field.value === undefined ||
            field.value === null ||
            Number.isNaN(field.value)
              ? undefined
              : field.value
          }
          onChange={(val) => {
            field.onChange(Number.isNaN(val) ? undefined : val);
          }}
        >
          <Label>{label}</Label>
          <NumberField.Group>
            <NumberField.DecrementButton />
            <NumberField.Input placeholder={placeholder} />
            <NumberField.IncrementButton />
          </NumberField.Group>
          {description && !error && <Description>{description}</Description>}
          <FieldError>{error?.message}</FieldError>
        </NumberField>
      )}
    />
  );
}

// ==================== TEXTAREA INPUT ====================

interface TextareaInputProps<T extends FieldValues> extends BaseInputProps<T> {
  rows?: number;
  maxLength?: number;
  showCount?: boolean;
}

export type { TextareaInputProps };

export function TextareaInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder,
  rows = 4,
  maxLength,
  showCount = false,
  isRequired = false,
  isDisabled = false,
  className,
  description,
}: TextareaInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => {
        const currentLength = (field.value ?? "").length;

        return (
          <TextField
            className={className}
            isDisabled={isDisabled}
            isRequired={isRequired}
            isInvalid={!!error}
          >
            <Label>{label}</Label>
            <InputGroup>
              <InputGroup.TextArea
                {...field}
                placeholder={placeholder}
                value={field.value ?? ""}
                rows={rows}
                maxLength={maxLength}
                className="resize-none"
              />
            </InputGroup>
            {(description || (showCount && maxLength)) && !error && (
              <Description className="flex w-full items-center justify-between px-1">
                <span>{description ?? ""}</span>
                {showCount && maxLength && (
                  <span className="ml-auto tabular-nums">
                    {currentLength}/{maxLength}
                  </span>
                )}
              </Description>
            )}
            <FieldError>{error?.message}</FieldError>
          </TextField>
        );
      }}
    />
  );
}

// ==================== DATE PICKER INPUT ====================
// Replaces: <TextInput type="date" />

interface DatePickerInputProps<
  T extends FieldValues,
> extends BaseInputProps<T> {
  minValue?: DateValue;
  maxValue?: DateValue;
  granularity?: "day" | "hour" | "minute" | "second";
}

export type { DatePickerInputProps };

export function DatePickerInput<T extends FieldValues>({
  name,
  control,
  label,
  isRequired = false,
  isDisabled = false,
  className,
  description,
  minValue,
  maxValue,
  granularity,
}: DatePickerInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <DatePicker
          className={className}
          isDisabled={isDisabled}
          isRequired={isRequired}
          isInvalid={!!error}
          minValue={minValue}
          maxValue={maxValue}
          granularity={granularity}
          value={(field.value as DateValue | null | undefined) ?? null}
          onChange={(val) => field.onChange(val)}
        >
          <Label>{label}</Label>
          <DateField.Group fullWidth>
            <DateField.Input>
              {(segment) => <DateField.Segment segment={segment} />}
            </DateField.Input>
            <DateField.Suffix>
              <DatePicker.Trigger>
                <DatePicker.TriggerIndicator />
              </DatePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DatePicker.Popover>
            <Calendar aria-label={label}>
              <Calendar.Header>
                <Calendar.YearPickerTrigger>
                  <Calendar.YearPickerTriggerHeading />
                  <Calendar.YearPickerTriggerIndicator />
                </Calendar.YearPickerTrigger>
                <Calendar.NavButton slot="previous" />
                <Calendar.NavButton slot="next" />
              </Calendar.Header>
              <Calendar.Grid>
                <Calendar.GridHeader>
                  {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                </Calendar.GridHeader>
                <Calendar.GridBody>
                  {(date) => <Calendar.Cell date={date} />}
                </Calendar.GridBody>
              </Calendar.Grid>
            </Calendar>
          </DatePicker.Popover>
          {description && !error && <Description>{description}</Description>}
          <FieldError>{error?.message}</FieldError>
        </DatePicker>
      )}
    />
  );
}

// ==================== DATE RANGE PICKER INPUT ====================

interface DateRange {
  start: DateValue;
  end: DateValue;
}

interface DateRangePickerInputProps<
  T extends FieldValues,
> extends BaseInputProps<T> {
  minValue?: DateValue;
  maxValue?: DateValue;
  startName?: string;
  endName?: string;
}

export type { DateRange, DateRangePickerInputProps };

export function DateRangePickerInput<T extends FieldValues>({
  name,
  control,
  label,
  isRequired = false,
  isDisabled = false,
  className,
  description,
  minValue,
  maxValue,
  startName,
  endName,
}: DateRangePickerInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <DateRangePicker
          className={className}
          isDisabled={isDisabled}
          isInvalid={!!error}
          minValue={minValue}
          maxValue={maxValue}
          startName={startName}
          endName={endName}
          value={(field.value as DateRange | null | undefined) ?? null}
          onChange={(val) => field.onChange(val)}
        >
          <Label>{label}</Label>
          <DateField.Group fullWidth>
            <DateField.InputContainer>
              <DateField.Input slot="start">
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
              <DateRangePicker.RangeSeparator />
              <DateField.Input slot="end">
                {(segment) => <DateField.Segment segment={segment} />}
              </DateField.Input>
            </DateField.InputContainer>
            <DateField.Suffix>
              <DateRangePicker.Trigger>
                <DateRangePicker.TriggerIndicator />
              </DateRangePicker.Trigger>
            </DateField.Suffix>
          </DateField.Group>
          <DateRangePicker.Popover>
            <RangeCalendar aria-label={label}>
              <RangeCalendar.Header>
                <RangeCalendar.YearPickerTrigger>
                  <RangeCalendar.YearPickerTriggerHeading />
                  <RangeCalendar.YearPickerTriggerIndicator />
                </RangeCalendar.YearPickerTrigger>
                <RangeCalendar.NavButton slot="previous" />
                <RangeCalendar.NavButton slot="next" />
              </RangeCalendar.Header>
              <RangeCalendar.Grid>
                <RangeCalendar.GridHeader>
                  {(day) => (
                    <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>
                  )}
                </RangeCalendar.GridHeader>
                <RangeCalendar.GridBody>
                  {(date) => <RangeCalendar.Cell date={date} />}
                </RangeCalendar.GridBody>
              </RangeCalendar.Grid>
            </RangeCalendar>
          </DateRangePicker.Popover>
          {description && !error && <Description>{description}</Description>}
          <FieldError>{error?.message}</FieldError>
        </DateRangePicker>
      )}
    />
  );
}

// ==================== TIME FIELD INPUT ====================

interface TimeFieldInputProps<T extends FieldValues> extends BaseInputProps<T> {
  granularity?: "hour" | "minute" | "second";
  hourCycle?: 12 | 24;
  hideTimeZone?: boolean;
  minValue?: TimeValue;
  maxValue?: TimeValue;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

export type { TimeFieldInputProps };

export function TimeFieldInput<T extends FieldValues>({
  name,
  control,
  label,
  isRequired = false,
  isDisabled = false,
  className,
  description,
  granularity,
  hourCycle,
  hideTimeZone,
  minValue,
  maxValue,
  startContent,
  endContent,
}: TimeFieldInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => (
        <TimeField
          className={className}
          isDisabled={isDisabled}
          isRequired={isRequired}
          isInvalid={!!error}
          granularity={granularity}
          hourCycle={hourCycle}
          hideTimeZone={hideTimeZone}
          minValue={minValue ?? undefined}
          maxValue={maxValue ?? undefined}
          value={(field.value as TimeValue | null | undefined) ?? null}
          onChange={(val) => field.onChange(val)}
        >
          <Label>{label}</Label>
          <TimeField.Group fullWidth>
            {startContent && (
              <TimeField.Prefix>{startContent}</TimeField.Prefix>
            )}
            <TimeField.Input>
              {(segment) => <TimeField.Segment segment={segment} />}
            </TimeField.Input>
            {endContent && <TimeField.Suffix>{endContent}</TimeField.Suffix>}
          </TimeField.Group>
          {description && !error && <Description>{description}</Description>}
          <FieldError>{error?.message}</FieldError>
        </TimeField>
      )}
    />
  );
}

// ==================== SELECT INPUT ====================
interface SelectOption {
  id: Key;
  label: string;
  isDisabled?: boolean;
}

interface SelectSection {
  id: Key;
  heading: string;
  options: SelectOption[];
}

interface SelectInputProps<T extends FieldValues> extends BaseInputProps<T> {
  options?: SelectOption[];
  sections?: SelectSection[];
  selectionMode?: "single" | "multiple";
  placeholder?: string;
  disabledKeys?: Iterable<Key>;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
}

export type { SelectOption, SelectSection, SelectInputProps };

export function SelectInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder = "Select one",
  options,
  sections,
  selectionMode = "single",
  disabledKeys,
  isRequired = false,
  isDisabled = false,
  className,
  description,
  variant = "primary",
  fullWidth = false,
}: SelectInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState: { error } }) => {
        // Normalize value: RHF stores plain string/string[]; Select expects Key | Key[] | null
        const value: Key | Key[] | null =
          field.value === undefined || field.value === null
            ? null
            : field.value;

        return (
          <Select
            className={className}
            isDisabled={isDisabled}
            isRequired={isRequired}
            isInvalid={!!error}
            selectionMode={selectionMode}
            disabledKeys={disabledKeys}
            variant={variant}
            fullWidth={fullWidth}
            placeholder={placeholder}
            value={value}
            onChange={(val) => field.onChange(val)}
          >
            <Label>{label}</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {sections
                  ? sections.map((section) => (
                      <ListBox.Section key={section.id}>
                        <div className="px-2 py-1 text-xs font-semibold text-default-400 uppercase">
                          {section.heading}
                        </div>
                        {section.options.map((opt) => (
                          <ListBox.Item
                            key={opt.id}
                            id={opt.id}
                            textValue={opt.label}
                          >
                            {opt.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox.Section>
                    ))
                  : options?.map((opt) => (
                      <ListBox.Item
                        key={opt.id}
                        id={opt.id}
                        textValue={opt.label}
                      >
                        {opt.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
              </ListBox>
            </Select.Popover>
            {description && !error && <Description>{description}</Description>}
            <FieldError>{error?.message}</FieldError>
          </Select>
        );
      }}
    />
  );
}

// ==================== AUTOCOMPLETE INPUT ====================

interface AutocompleteOption {
  id: Key;
  label: string;
  sub?: string;
}

interface AutocompleteInputProps {
  options: AutocompleteOption[];
  selectedKey: Key | null;
  onSelectionChange: (key: Key | null) => void;
  placeholder?: string;
  label?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  className?: string;
  description?: string;
}

export type { AutocompleteOption, AutocompleteInputProps };

export function AutocompleteInput({
  options,
  selectedKey,
  onSelectionChange,
  placeholder = "Search or select...",
  label,
  isRequired = false,
  isDisabled = false,
  className,
  description,
}: AutocompleteInputProps) {
  const { contains } = useFilter({ sensitivity: "base" });

  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      {label && <Label isRequired={isRequired}>{label}</Label>}
      <Autocomplete
        isDisabled={isDisabled}
        placeholder={placeholder}
        selectedKey={selectedKey}
        onSelectionChange={(key) => onSelectionChange(key)}
      >
        <Autocomplete.Trigger className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-background-200 bg-white px-3 text-sm outline-none transition-colors focus:border-primary-400 dark:border-background-700 dark:bg-background-900">
          <Autocomplete.Value />
          <Autocomplete.ClearButton className="text-sm text-text-400" />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={contains}>
            <SearchField autoFocus name="search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder={placeholder} />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox
              className="max-h-64 overflow-auto p-2"
              renderEmptyState={() => <EmptyState>No results found</EmptyState>}
            >
              {options.map((opt) => (
                <ListBox.Item id={opt.id} key={opt.id} textValue={opt.label}>
                  <div className="py-1">
                    <p className="font-medium text-text-900 dark:text-text-50">
                      {opt.label}
                    </p>
                    {opt.sub && (
                      <p className="text-xs text-text-400">{opt.sub}</p>
                    )}
                  </div>
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
      {description && <Description>{description}</Description>}
    </div>
  );
}

// ==================== EXPORTS ====================

export { TextInput as Text };
export { PasswordInput as Password };
export { NumberInput as Number };
export { TextareaInput as Textarea };
export { DatePickerInput as DatePicker };
export { DateRangePickerInput as DateRangePicker };
export { TimeFieldInput as Time };
export { SelectInput as Select };
export { AutocompleteInput as Autocomplete };
