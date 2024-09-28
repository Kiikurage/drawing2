class Dataclass<OwnProps extends Record<string, unknown>> {
	constructor(props: OwnProps) {
		Object.assign(this, props);
	}

	copy(props: Partial<OwnProps> = {}): this {
		return new (this as any).constructor({ ...this, ...props });
	}

	equals(other: this) {
		return (Object.keys({ ...this }) as (keyof this)[]).every(
			(key) => this[key] === other[key],
		);
	}

	toString(): string {
		return `${this.constructor.name}(${JSON.stringify({ ...this })})`;
	}

	// Actual type of props is `OwnProps`, but cannot use here since this is static method.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static create(props: any) {
		return new this(props);
	}
}

export function dataclass<T>() {
	interface DataClass {
		copy(props?: Partial<T>): this;

		equals(other: this): boolean;
	}

	return Dataclass as never as {
		new (props: T): Readonly<T> & DataClass;
	};
}
