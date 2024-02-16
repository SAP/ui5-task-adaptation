export default interface DiffCase {

    accept(target: any[], i: number, name?: string): void;
    canAccept(target: any[], name?: string): boolean;

}
