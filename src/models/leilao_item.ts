import User from "./user";

export default interface LeilaoItem {
    id: string;
    nome: string;
    lanceInicial: number;
    incrementoMinimoLance: number;
    lanceAtual?: number;
    ofertanteAtual?: User;
    endTime: Date;
}