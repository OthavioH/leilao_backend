import LeilaoItem from "./leilao_item";
import User from "./user";

export default interface Leilao {
    id: string;
    item: LeilaoItem;
    lanceInicial: number;
    incrementoMinimoLance: number;
    lanceAtual?: number;
    ofertanteAtual?: User;
    endTime: Date;
    users: User[];
}