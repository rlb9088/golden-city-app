'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from 'react';

interface ListInputProps {
  id?: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

/**
 * Campo de seleccion restringida a una lista oficial: desplegable + autocompletado al escribir.
 * Solo acepta valores de `options` (el formulario no se puede enviar con un valor fuera de lista).
 */
const ListInput = forwardRef<HTMLInputElement, ListInputProps>(function ListInput(
  { id, value, options, onChange, placeholder, required },
  ref,
) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const findOption = (text: string) => options.find((option) => option.toLowerCase() === text.trim().toLowerCase());

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const invalid = value.trim() !== '' && !findOption(value);
    input.setCustomValidity(invalid ? 'Selecciona un valor de la lista. Si no existe, agrégalo en Configuración.' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        className="input"
        list={listId}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          const match = findOption(value);
          if (match && match !== value) onChange(match);
        }}
      />
      <datalist id={listId}>
        {options.map((option) => <option key={option} value={option} />)}
      </datalist>
    </>
  );
});

export default ListInput;
