package circuits

import (
	"fmt"

	"github.com/brevis-network/brevis-sdk/sdk"
)

type AppCircuit struct {
	ChallengerAddress sdk.Bytes32 `json:"challengerAddress"`
	OrderHash         sdk.Bytes32 `json:"orderHash"`
}

var _ sdk.AppCircuit = &AppCircuit{}

func DefaultAppCircuit() *AppCircuit {
	return &AppCircuit{
		ChallengerAddress: sdk.ConstFromBigEndianBytes([]byte{}),
		OrderHash:         sdk.ConstFromBigEndianBytes([]byte{}),
	}
}

func (c *AppCircuit) Allocate() (maxReceipts, maxStorage, maxTransactions int) {
	return 0, 32, 0
}

func (c *AppCircuit) Define(api *sdk.CircuitAPI, in sdk.DataInput) error {
	slots := sdk.NewDataStream(api, in.StorageSlots)

	slots.Show()

	lpSlot := sdk.GetUnderlying(slots, 0)
	challengerSlot := sdk.GetUnderlying(slots, 1)

	lpTokens := api.ToUint248(lpSlot.Value)
	challengerTokens := api.ToUint248(challengerSlot.Value)

	fmt.Println(lpTokens.Val)
	fmt.Println(challengerTokens.Val)

	isGreater := api.Uint248.IsGreaterThan(lpTokens, challengerTokens)

	api.OutputBool(isGreater)
	api.OutputBytes32(c.ChallengerAddress)
	api.OutputBytes32(c.OrderHash)

	return nil
}
